function iniciaAjax() {
  var objetoAjax = false;

  if (window.XMLHttpRequest) {
    objetoAjax = new XMLHttpRequest();
  }
  else if (window.ActiveXObject) {
    try {
      objetoAjax = new ActiveXObject('Msxml2.XMLHTTP');
    }
    catch(e) {
      try {
        objetoAjax = new ActiveXObject('Microsoft.XMLHTTP');
      }
      catch(ex) {
        objetoAjax = false;
      }
    }
  }

  return objetoAjax;
}

var reqAjax = iniciaAjax();

if (reqAjax) {
  reqAjax.onreadystatechange = function() {
    var status = reqAjax.status.toString();
    console.log(status);

    if (reqAjax.readyState == 4 && reqAjax.status == 200) {
      document.getElementById("content").innerHTML = reqAjax.responseText;
    }
    else if (status.match(/\b(4|5)/g)) {
      document.getElementById("content").innerHTML = 'Error';
    }
    else if (reqAjax.readyState < 4) {
      document.getElementById('content').innerHTML = 'Wait please.';
    }
  };
  reqAjax.open('POST', '/api/v1/send', true);
  reqAjax.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
  reqAjax.send();
}
