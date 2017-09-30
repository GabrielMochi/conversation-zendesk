'use strict';

//zendesk and conversation APIs.
var zendesk = require('node-zendesk');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var watson = require('watson-developer-cloud');
var fs = require('fs');
var winston = require('winston');
var prompt = require('prompt');
var morgan = require('morgan');
var auth = require('http-auth');

var fileSettings = {
  name: 'faq.txt',
  path: './faq/faq.txt'
};

var configSetting = {
  name: 'config.json',
  path: './config.json'
};

switch (process.argv[2]) {

  case '--clear':

    winston.info('[Clear] Clearing the file: ' + fileSettings.name + '\n');
    fs.truncate(fileSettings.path, 0, function (err) {
      if (err) {
        console.log('\n');
        winston.error('[Clear] fileSystem encountered a problem while trying to clean the file: ' + fileSettings.name);
        winston.error('[Clear] Error message: ' + err.message + '\n');
        return err;
      }
      console.log('\n');
      winston.info('[Clear] Success while cleaning the file: ' + fileSettings.name);
      winston.log('Clear] Process done!');
    });

    break;

  case '--setup':

    winston.info('[Setup] Creating a setup configuration\n');

    prompt.start();

    prompt.get([
      'watson_convesation_username',
      'watson_convesation_password',
      'zendesk_username',
      'zendesk_token',
      'zendesk_remoteUri'
    ], function (err, input) {
      if (err) {
        console.log('\n');
        winston.error('[Setup] prompt encountered a problem while trying to get the credentials');
        winston.error('[Setup] Error message: ' + err.message + '\n');
        return err;
      }
      fs.writeFile(configSetting.path, JSON.stringify(input, null, 2), function (err) {
        if (err) {
          winston.error('[Setup] fileSystem encountered a problem while trying to create the file: ' + configSetting.name);
          winston.error('[Setup] Error message: ' + err.message + '\n');
          return err;
        }
        console.log('\n');
        winston.info('[Setup] Success while create the file: ' + configSetting.name);
        winston.info('[Setup] Process done!');
      });
    });

    break;

  default:

    try {
      var configSetting = fs.readFileSync(configSetting.path);
    } catch (err) {
      console.log('\n');
      winston.error('Error message: ' + err.message + '\n');
      winston.info('First of all, you need to create the config file. For this, run: node app --setup' + '\n');
      return process.exit(1);
    } finally {
      var configContent = JSON.parse(configSetting);
    }

    var config = require('./config');

    // Conversation credentials.
    var conversation = watson.conversation({
      username: configContent.watson_convesation_username,
      password: configContent.watson_convesation_password,
      version_date: '{version}',
      version: 'v1'
    });

    // Zendesk credentials.
    var client = zendesk.createClient({
      username: configContent.zendesk_username,
      token: configContent.zendesk_token,
      remoteUri: configContent.zendesk_remoteUri
    });

    var basic = auth.basic({
        realm: "Conversation Zendesk.",
        file: "./app/models/auth.htpasswd"
    });

    app.use(morgan('dev'));
    app.use('/', express.static('./public/post_data'));
    app.use('/api/v1/send', auth.connect(basic));
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());

    app.post('/api/v1/send', function(req, res) {
      client.tickets.list(function (err, req, result) {
        if (!err) {
          var lastNumber = result.length;
          var lastTicketId = result[lastNumber - 1].id;
          // Lists the comments and properties of a specific ticket.
          client.requests.listComments(lastTicketId, function (err , req , result) {
            if (!err) {
              var lastCommentId = result[0].comments[0].id;
              var zendeskInput = result[0].comments[0].plain_body;
              // Append text in the file
              fs.appendFile(fileSettings.path, '\r\n' + zendeskInput, function(err) {
                if (err) {
                  winston.info('The file ' + fileSettings.name + 'wasn\'t find \n');
                  winston.error('Error message:' + err.message + '\n');
                }
              });
              // Connects to the conversation API that will provide the same response.
              conversation.message({
                workspace_id: '{workspace ID}',
                input: {
                  'text': zendeskInput
                }
              },  function(err , response) {
                if (!err) {
                  // If the response has a confidence greater than 85%, it will be sent to the user.
                  if (response.intents[0].confidence > 0.85) { // Edit the percentage of confidence how much you want.
                    var responseOutput = response.output.text[0];
                    var responseTicket = {
                      "ticket": {
                        "comment": {
                          "body": responseOutput
                        }
                      }
                    };
                    // Update the ticket by sending the new conversation message together.
                    client.tickets.update(lastTicketId , responseTicket , function (err , req , result) {
                      if (!err) {
                        res.setHeader('Content-Type', 'application/json');
                        res.json({ result, response });
                        res.end();
                      }
                    });
                  }
                  else {
                    var responseInternalTicket = {
                      "ticket": {
                        "comment": {
                          "body": "O Conversation não consegui responder a mensagem.",
                          "public": false
                        }
                      }
                    };
                    // If the response has a lower confidence that has been defined, it will be sent as an internal comment.
                    client.tickets.update(lastTicketId, responseInternalTicket, function (err , req ,  result) {
                      if (!err) {
                        res.setHeader('Content-Type', 'application/json');
                        res.json(result);
                        res.end();
                      }
                    });
                  }
                }
              });
            }
          });
        }
      });
    });

    var port = process.env.PORT || 8080;

    app.listen(port, function () {
        console.log('Magics occur at the port: %d', port);
    });

    module.exports = app;
}
