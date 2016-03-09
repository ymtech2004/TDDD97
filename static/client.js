var passwordTooShort = "less than 6 characters";
var browsing_email;
var svg, chart;
var live_data;
var ws;

function loginAndSaveToken(token, email) {
	sessionStorage.setItem("token", reply.data);
	checkIfLogin();	
	OpenWebSocket(email);
}

function checkPwdLength(password) {
	if (password.length < 6)
		return false;
	return true;
}

function findTag() {
	return window.location.hash.substr(1);
}

function checkEmailForm(str) {
	if (str.indexOf('@') <= 0)
		return false;
	else if (str.slice(-1) == '@')
		return false;
	return true;
}

function checkIfLogin() {
	if (sessionStorage.getItem("token") == undefined) {
		document.getElementById("mainview").innerHTML = document.getElementById("welcomeview").text;
		window.location.hash = '';
	}
	else { 
		var tabs = document.getElementById('tabs');
		if (tabs == undefined) {
			document.getElementById("mainview").innerHTML = document.getElementById("profileview").text;
			tabs = document.getElementById('tabs').getElementsByTagName("a");
		}
		else
			tabs = tabs.getElementsByTagName("a");
		var tag = findTag();
		if (tag == '')
			tag='account';
		for (var i = 0; i < tabs.length; i++) {
			if (tabs[i].rel.indexOf(tag) > -1) {
				if (tag == "home") {	
					loadHomePage();
				}
				else if (tag == "browse") {
					loadBrowsePage();
				}
				else {
					loadAccountPage();
				}
				tabs[i].className="selected";
			}
			else
				tabs[i].className="";
		}
	}
}

//for personal page
function loadPersonalInfo(data) {
	document.getElementById("personal_content").innerHTML = document.getElementById("personal_page_info").text;
	document.getElementById("info_name").innerHTML += (data.firstname + " " + data.familyname);
	document.getElementById("info_gender").innerHTML += data.gender;
	document.getElementById("info_city").innerHTML += data.city;
	document.getElementById("info_country").innerHTML += data.country;
	document.getElementById("info_email").innerHTML += data.email;
}

function loadMessageWall(data, to, own) {
	document.getElementById(to).innerHTML = "";
	for (var i = 0; i < data.length ; i++) {
		document.getElementById(to).innerHTML += 
			("<p id=\""+ own +"message" +i +"\" draggable=\"true\" ondragstart=\"drag(event)\">" + data[i].writer + " : " + data[i].content+ "</p>");
	}
}

function loadUserInfo(data, to) {
	document.getElementById(to + "personal_content").innerHTML = document.getElementById(to + "personal_page_info").text;
	document.getElementById(to + "info_name").innerHTML += (data.firstname + " " + data.familyname);
	document.getElementById(to + "info_gender").innerHTML += data.gender;
	document.getElementById(to + "info_city").innerHTML += data.city;
	document.getElementById(to + "info_country").innerHTML += data.country;
	document.getElementById(to + "info_email").innerHTML += data.email;
}

function getOwnInfo() {
	var xhttp = new XMLHttpRequest();
	var postData = JSON.stringify({ 'token': sessionStorage.getItem("token")});
	xhttp.onreadystatechange = function() {
		if (xhttp.readyState == 4 && xhttp.status == 200) {
			reply = JSON.parse(xhttp.responseText);
        	if (reply.success) {
				loadUserInfo(reply.data, "home_");
			}
		}
	};
	xhttp.open("POST", "getuserdatabytoken", true);
	xhttp.setRequestHeader("Content-type", "application/json");
	xhttp.send(postData);
}

function getUserInfo(email) {
	var xhttp = new XMLHttpRequest();
	var postData = JSON.stringify({ 'token': sessionStorage.getItem("token"),'email': email});
	xhttp.onreadystatechange = function() {
		if (xhttp.readyState == 4 && xhttp.status == 200) {
			reply = JSON.parse(xhttp.responseText);
        	if (reply.success) {
				loadUserInfo(reply.data, "browse_");
				getUserMessage(email);
			}
			else
				document.getElementById("browse_personal_content").innerHTML = reply.message;
		}
	};
	xhttp.open("POST", "getuserdatabyemail", true);
	xhttp.setRequestHeader("Content-type", "application/json");
	xhttp.send(postData);
}

function getUserMessage() {
	var xhttp = new XMLHttpRequest();
	var postData = JSON.stringify({ 'token': sessionStorage.getItem("token"),
									'email':browsing_email});
	xhttp.onreadystatechange = function() {
		if (xhttp.readyState == 4 && xhttp.status == 200) {
			reply = JSON.parse(xhttp.responseText);
			if (reply.success) {
				loadMessageWall(reply.data, "browse_message_wall", "user");
			}
		}
	};
	xhttp.open("POST", "getusermessagesbyemail", true);
	xhttp.setRequestHeader("Content-type", "application/json");
	xhttp.send(postData);
}

function getOwnMessage() {
	var xhttp = new XMLHttpRequest();
	var postData = JSON.stringify({ 'token': sessionStorage.getItem("token")});
	xhttp.onreadystatechange = function() {
		if (xhttp.readyState == 4 && xhttp.status == 200) {
			reply = JSON.parse(xhttp.responseText);
        	if (reply.success) 
				loadMessageWall(reply.data, "home_message_wall", "own");
		}
	};
	xhttp.open("POST", "getusermessagesbytoken", true);
	xhttp.setRequestHeader("Content-type", "application/json");
	xhttp.send(postData);
}

//call when submit a message
function sendMessage(to) {
	var token = sessionStorage.getItem("token");
	var message;
	var target;
	if (to=='') {
		target = 'browse_';
		to = browsing_email;
	}
	else {
		target = 'home_';
	}
	message = document.getElementById(target + "mw_input_box").value;


	var xhttp = new XMLHttpRequest();
	var postData = JSON.stringify({ 'token': sessionStorage.getItem("token"),
									'email': to,
									'message': message});
	xhttp.onreadystatechange = function() {
		if (xhttp.readyState == 4 && xhttp.status == 200) {
			reply = JSON.parse(xhttp.responseText);
        	document.getElementById(target + "mw_warning").innerHTML = reply.message;
			if (reply.success) {
				document.getElementById(target + "mw_input_box").value = "";
				if (target == "home_")
					getOwnMessage();
				else if (target == "browse_")
					getUserMessage(to);
			}
		}
	};
	xhttp.open("POST", "postmessage", true);
	xhttp.setRequestHeader("Content-type", "application/json");
	xhttp.send(postData);
}

function loadOwnPage() {
	getOwnInfo();
	getOwnMessage();
}

function loadBrowseUser() {
	browsing_email = document.getElementById("search_bar_email").value
	getUserInfo(browsing_email);
}

//
function loadHomePage() {
	document.getElementById("content_account").style.display = "none";
	document.getElementById("content_home").style.display = "block";
	document.getElementById("content_browse").style.display = "none";
	loadOwnPage();
}

function loadBrowsePage() {
	document.getElementById("content_account").style.display = "none";
	document.getElementById("content_home").style.display = "none";
	document.getElementById("content_browse").style.display = "block";
}


function loadAccountPage() {
	document.getElementById("content_account").style.display = "block";
	document.getElementById("content_home").style.display = "none";
	document.getElementById("content_browse").style.display = "none";
	window.location.hash = '#account';
	loadLiveDataChart();

}


//determine which should load while logging in
function loadPage(element) {
	var tabs = document.getElementById('tabs').getElementsByTagName("a");
	for (var i = 0; i < tabs.length; i++) {
		if (tabs[i].rel.indexOf(element.rel) > -1) {
			if (element.rel.indexOf("account") > -1)
				loadAccountPage();
			else {
				if (element.rel.indexOf("home") > -1 ) {
					loadHomePage();
				}
				else if (element.rel.indexOf("browse") > -1) {
					loadBrowsePage();
				}
			}
			tabs[i].className="selected";
		}
		else
			tabs[i].className="";
	}
}

//account tab : chagne password
function changePW() {
	var currentPwd = document.getElementById("c_password").value;
	var newPwd = document.getElementById("new_password").value;
	if (!checkPwdLength(currentPwd) || !checkPwdLength(newPwd))
		document.getElementById("change_password_warning").innerHTML = passwordTooShort;
	else {

		var xhttp = new XMLHttpRequest();
		var postData = JSON.stringify({ 'old_password': currentPwd,
								 'new_password': newPwd,
								 'token': sessionStorage.getItem("token")});
		xhttp.onreadystatechange = function() {
			if (xhttp.readyState == 4 && xhttp.status == 200) {
				reply = JSON.parse(xhttp.responseText);
	        	if (reply['success']) {
					document.getElementById("c_password").value = "";
					document.getElementById("new_password").value = "";				
				}
				document.getElementById("change_password_warning").innerHTML = reply['message'];
			}
		};
		xhttp.open("POST", "changepassword", true);
		xhttp.setRequestHeader("Content-type", "application/json");
		xhttp.send(postData);
	}
}

//account tab : log out
function logout() {
	var xhttp = new XMLHttpRequest();
	var postData = JSON.stringify({ 'token': sessionStorage.getItem("token")});
	xhttp.onreadystatechange = function() {
		if (xhttp.readyState == 4 && xhttp.status == 200) {
			reply = JSON.parse(xhttp.responseText);
        	if (reply['success']) {
    			document.getElementById("content").innerHTML = "Log out";
				sessionStorage.removeItem("token");
				svg = null;
				chart = null;
				checkIfLogin();
        	}
		}
	};
	xhttp.open("POST", "signout", true);
	xhttp.setRequestHeader("Content-type", "application/json");
	xhttp.send(postData);
    return false;
}

function login() {
	
	//send query to server, get token if success
	var email = document.getElementById("lemail").value;
	if (!checkEmailForm(email)) {
		document.getElementById("lwarning").innerHTML = "not email form";
		return false;	
	}

	//check password length
    var pwd = document.getElementById("lpwd").value;
	if (!checkPwdLength(pwd)) {
		document.getElementById("lwarning").innerHTML = passwordTooShort;
		return false;
	} 
	var postData = JSON.stringify({ 'email': email,
								 'pwd': pwd});
    
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (xhttp.readyState == 4 && xhttp.status == 200) {
			reply = JSON.parse(xhttp.responseText)
        	
        	if (reply['success']) {
        		loginAndSaveToken(reply['data'], email);
        		
        	}
        	else 
        		document.getElementById("lwarning").innerHTML = reply['message'];
		}
	};
	xhttp.open("POST", "signin", true);
	xhttp.setRequestHeader("Content-type", "application/json");
	xhttp.send(postData);
    return false
}

function signup() {
	//send query to server, get token if success
	var firstname = document.getElementById("first_name").value;
	if (firstname == '') {
		document.getElementById("warning").innerHTML = 'empty first name';
		return false;
	}
	var familyname = document.getElementById("family_name").value;
	if (familyname == '') {
		document.getElementById("warning").innerHTML = 'empty family name';
		return false;
	}
	var gender = document.getElementById("gender").value;
	var city = document.getElementById("city").value;
	if (city == '') {
		document.getElementById("warning").innerHTML = 'empty city';
		return false;
	}
	var country = document.getElementById("country").value;
	if (country == '') {
		document.getElementById("warning").innerHTML = 'empty country';
		return false;
	}
	var email = document.getElementById("email").value;
	if (!checkEmailForm(email)) {
		document.getElementById("warning").innerHTML = 'not in email form';
		return false;
	}

	//check password length and if password is same is repeated one
	var pwd = document.getElementById("password").value;
	var rpwd = document.getElementById("rpassword").value;
	if (!checkPwdLength(pwd) || !checkPwdLength(rpwd)) {
		document.getElementById("warning").innerHTML = passwordTooShort;
		return false;
	}
	else {
		document.getElementById("warning").innerHTML = "";
	}

	if (pwd != rpwd) {
		document.getElementById("warning").innerHTML = "passwords not the same";
		return false;
	}
	else {
		document.getElementById("warning").innerHTML = "";
	}


	var xhttp = new XMLHttpRequest();
	var postData = JSON.stringify({ 'firstname': firstname,
								 'familyname': familyname,
								 'gender': gender,
								 'city': city,
								 'country': country,
								 'email': email,
								 'password': pwd });
	xhttp.onreadystatechange = function() {
		if (xhttp.readyState == 4 && xhttp.status == 200) {
			reply = JSON.parse(xhttp.responseText);
        	if (reply['success'])
        		loginAndSaveToken(reply['data'], email);
        	else 
        		document.getElementById("warning").innerHTML = reply['message'];
		}
	};
	xhttp.open("POST", "signup", true);
	xhttp.setRequestHeader("Content-type", "application/json");
	xhttp.send(postData);

    return false;
}


//----------------- web socket -----------------
function OpenWebSocket(email)
{
	if ("WebSocket" in window)
	{
		ws = new WebSocket("ws://localhost:5023/socket");

		ws.onopen = function(){
			// Web Socket is connected, send email to the server
			ws.send(email);
			console.log('socket open');
		};

		ws.onmessage = function (evt) { 
			var reply = JSON.parse(evt.data);
			if (reply['message'] == 'logout') {
				sessionStorage.removeItem("token");
				checkIfLogin();
			}
			else if (reply['message'] == 'livedata') {
				getDataJSON(reply['total_user'], 
								reply['online_user'], 
								reply['total_view'], 
								reply['user_view'], 
								reply['max_user_view'], 
								reply['total_message'], 
								reply['user_message'], 
								reply['max_user_message']);
				loadLiveDataChart();
				updateLiveData();
			}
		};

		ws.onclose = function(){ 
			// websocket is closed.
			console.log('Connection is closed...');
		};
	}
}
//------------- drag and drop -------------
function allowDrop(ev) {
    ev.preventDefault();
}

function drag(ev) {
    ev.dataTransfer.setData("text", ev.target.id);
}

function drop(ev) {
    ev.preventDefault();
    var data = ev.dataTransfer.getData("text");
    ev.target.value += document.getElementById(data).innerHTML;
}

function dropp(ev) {
  ev.preventDefault();
  var data=ev.dataTransfer.getData("text");
  var nodeCopy = document.getElementById(data).cloneNode(true);
  nodeCopy.id = "newId"; /* We cannot use the same ID */
  ev.target.appendChild(nodeCopy);
}


// ------------- live data -------------
function randomize(d) {
  if (!d.randomizer) d.randomizer = randomizer(d);
  d.ranges = d.ranges.map(d.randomizer);
  return d;
}

function randomizer(d) {
  var k = d3.max(d.ranges) * .2;
  return function(d) {
    return Math.max(0, d + k * (Math.random() - .5));
  };
}


function getDataJSON(total_user, online_user, total_view, user_view, max_user_view, total_message, user_message, max_user_message) {
	live_data = JSON.parse('[{"title":"Users","subtitle":"online / total","ranges":[' 
	              + (total_user / 2)  + ',' + total_user +',' + (total_user * 3/ 2) 
	              + '],"measures":['+ online_user+',' + total_user 
	              + '],"markers":['+ (total_user * 3/ 2) 
	              + ']},{"title":"page views","subtitle":"views/ total views","ranges":[' 
	              + (total_view / 2)  + ',' + total_view +',' + (total_view * 3/ 2) + '],"measures":[' 
	              + user_view  + ',' +  total_view + '],"markers":[' 
	              + max_user_view + ']},{"title":"message amount","subtitle":"message/ total message","ranges":[' 
	              + (total_message / 2)  + ',' + total_message +',' + (total_message * 3/ 2) + '],"measures":[' 
	              + user_message  + ',' +  total_message + '],"markers":[' +max_user_message + ']}]');
}

function updateLiveData() 
{
	try {
		if (svg != null) {
			svg.data(live_data).call(chart);
		}
	} catch (err) {
		console.log('something wrong');
	}	
}

function loadLiveDataChart() {
	if (live_data == null)
		return;
	if (chart == null || svg == null) {
		var margin = {top: 5, right: 40, bottom: 20, left: 120},
	    width = 380 - margin.left - margin.right,
	    height = 50 - margin.top - margin.bottom;

		chart = d3.bullet()
		    .width(width)
		    .height(height);

		svg = d3.select("#account_live_data").selectAll("svg")
		  .data(live_data)
		.enter().append("svg")
		  .attr("class", "bullet")
		  .attr("width", width + margin.left + margin.right)
		  .attr("height", height + margin.top + margin.bottom)
		.append("g")
		  .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
		  .call(chart);

		var title = svg.append("g")
		  .style("text-anchor", "end")
		  .attr("transform", "translate(-6," + height / 2 + ")");

		title.append("text")
		  .attr("class", "title")
		  .text(function(d) { return d.title; });

		title.append("text")
		  .attr("class", "subtitle")
		  .attr("dy", "1em")
		  .text(function(d) { return d.subtitle; });
	}
}

window.onload = function() {
	checkIfLogin();
}

window.onhashchange = function() {
	checkIfLogin();
}
