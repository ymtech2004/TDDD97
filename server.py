import os
import hashlib, binascii

import database_helper
from flask import Flask, request, session, g, redirect, url_for, \
     abort, render_template, flash
from random import randint
import json
from flask_sockets import Sockets
from gevent import pywsgi
from geventwebsocket.handler import WebSocketHandler


app = Flask(__name__)
sockets = Sockets( app )
app.secret_key = os.urandom(24)
app.debug = True;
connected_users = {}

@app.route('/client.html')
def homePage():
    return render_template('client.html')

@app.route('/testDB')
def test():
    database_helper.init_db()
    return "open DB"

def generate_new_token():
    letters = "abcdefghiklmnopqrstuvwwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    token = ""
    for i in range(0, 35) :
        r = randint(0, 35)
        token += letters[r]
    return token

def get_info_with_email(email, from_):
    info = database_helper.get_info_by_email(email, from_)     
    response = {}
    if info is None:
        response['success'] = False
        response['message'] = 'No logsuch user.'
    else:
        response['success'] = True
        response['message'] = 'User data retrieved.'        
        response['data'] = {}
        response['data']['email'] = info['email']
        response['data']['firstname'] = info['firstname']
        response['data']['familyname'] = info['familyname']
        response['data']['gender'] = info['gender']
        response['data']['city'] = info['city']
        response['data']['country'] = info['country']
        send_live_data()
    return response

def get_message_with_email(email):
    response = {}
    if database_helper.check_user(email,'','exist'):
        messages = database_helper.get_messages(email)
        response['success'] = True
        response['message'] = 'User messages retrieved.'
        response['data'] = messages
        send_live_data()
    else:
        response['success'] = False
        response['message'] = 'No such user.'
    return response

def check_online_users():
    users = connected_users.items()
    for email,user in users:
        if user.closed:
            connected_users.pop(email)
    return len(connected_users)

def send_live_data():
    users = connected_users.items()
    for email,user in users:
        if user.closed:
            connected_users.pop(email)
        else:
            data = testdata(email)
            response = {}
            response['message'] = 'livedata'
            response['total_user'] = data['total_user'] 
            response['online_user'] = data['online_user'] 
            response['total_view'] = data['total_view'] 
            response['user_view'] = data['user_view'] 
            response['max_user_view'] = data['max_user_view'] 
            response['total_message'] = data['total_message'] 
            response['user_message'] = data['user_message'] 
            response['max_user_message'] = data['max_user_message'] 
            user.send(json.dumps(response))


'''
Description: Authentication the username by the provided password.
Input: Two string values representing the username (email address) and password.
Return data: A text string containing a randomly generated access token if the authentication is successfull.
'''
@app.route('/signin', methods = ['GET','POST'])
def sign_in():
    data = request.json
    email = data['email']
    password = data['pwd']
    check = database_helper.check_user(email, password)
    response = {}
    if check is True:
        response['success'] = True
        response['message'] = 'Successfully signed in.'
        token = generate_new_token()

        database_helper.store_new_token(email, token)
        response['data'] = token
    else:
        response['success'] = False
        response['message'] = 'Wrong username or password.'
    return json.dumps(response)

'''
Description: Registers a user in the database.
Input: Seven string values representing the following:email, password, firstname, familyname, gender, city, and country
Returned data: A text string containing a randomly generated access token if the authentication is successfull.
'''
@app.route('/signup', methods = ['GET','POST'])
def sign_up():
    data = request.json
    email = data['email']
    password = data['password']
    firstname = data['firstname']
    familyname = data['familyname']
    gender = data['gender']
    city = data['city']
    country = data['country']
    response = {}

    if database_helper.check_user(email, '','exist') is False:
        infos = []
        infos.append(email)
        
        # hash password
        salt = str(binascii.hexlify(os.urandom(16)))
        hpassword = str(binascii.hexlify(hashlib.pbkdf2_hmac('sha256', str(password), salt, 100000)))
        infos.append(hpassword)
        infos.append(salt)

        infos.append(firstname)
        infos.append(familyname)
        infos.append(gender)
        infos.append(city)
        infos.append(country)
        token = generate_new_token()
        database_helper.insert_user(infos)
        database_helper.store_new_token(email, token)
        response['success'] = True
        response['message'] = 'Successfully created a new user.'
        response['data'] = token
    else:
        response['success'] = False
        response['message'] = 'User already exists.'    
    
    return json.dumps(response)  

'''
Description: Signs out a user from the system
Input: A string containing the access token of the user requesting to sign out. 
Returned data: -
'''
@app.route('/signout', methods = ['GET','POST'])
def sign_out():
    
    token = request.json['token']
    response = {}
    email = database_helper.get_email_by_token(token)
    if email is not None:
        response['success'] = True
        response['message'] = 'Successfully signed out.'
        database_helper.delete_token(token)
        if email in connected_users:
            connected_users[email].close()
            connected_users.pop(email, None)
        send_live_data()
    else:   
        response['success'] = False
        response['message'] = 'You are not signed in.'
    return json.dumps(response) 


'''
Description: Changes the password of the current user to a new one.
Input:
    token: A string containing the access token of the current user
    oldPassword: The old password of the current user
    newPassword: The new password
Returned data: -
'''
@app.route('/changepassword' ,methods = ['GET','POST'])
def change_password():
    data = request.json
    token = data['token']
    old_password = data['old_password'] 
    new_password = data['new_password']
    email = database_helper.get_email_by_token(token)
    response = {}
    if email is  None:
        response['success'] = False
        response['message'] = 'You are not signed in.'
    else:
        if database_helper.check_user(email, old_password):
            salt = str(binascii.hexlify(os.urandom(16)))
            hnew_password = str(binascii.hexlify(hashlib.pbkdf2_hmac('sha256', str(new_password), salt, 100000)))
            database_helper.update_password(email, hnew_password, salt)
            response['success'] = True
            response['message'] = 'Password changed.'
        else:
            response['success'] = False
            response['message'] = 'Wrong password.'
    return json.dumps(response)     


'''
Description: Retrieves the stored data for the user whom the passed token is issued for. The signed in user can use this method to retrieve all its own information from the server.
Input: A string containing the access token of the current user.
Returned data:A text string containing the following information:
    email, firstname, familyname, gender, city, amd country.
'''
@app.route('/getuserdatabytoken',methods = ['GET','POST'])
def get_user_data_by_token():
    token = request.json['token']
    response = {}
    email = database_helper.get_email_by_token(token)
    if email is None:
        response['success'] = False
        response['message'] = 'You are not signed in.'  
    else:
        response = get_info_with_email(email, 'own')
    return json.dumps(response)


'''
Description:Retrieves the stored data for the user specified by the passwd email address.
Input:
    token: A string containing the access token of the current user
    email: The email address of the user to retrieve data for
Returned data:A text string containing the following information:
    email, firstname, familyname, gender, city, amd country.
'''
@app.route('/getuserdatabyemail', methods=['GET','POST'])
def get_user_data_by_email():
    token = request.json['token']
    email = database_helper.get_email_by_token(token)
    response = {}
    if email is None:
        response['success'] = False
        response['message'] = 'You are not signed in.'  
    else:
        response = get_info_with_email(request.json['email'], 'other')
    return json.dumps(response)

'''
Description: Retrieves the stored message for the user whom the passed token is issued for. The currently signed in user can use this method to retrieve all its own messages from the server.
Input: A string containing the access token of the current user.
Returned data: A text string containing all of the message sent to the user.
'''
@app.route('/getusermessagesbytoken', methods=['GET','POST'])
def get_user_messages_by_token():
    token = request.json['token']
    email = database_helper.get_email_by_token(token)
    response = {}
    if email is None:
        response['success'] = False
        response['message'] = 'You are not signed in.'  
    else:
        response = get_message_with_email(email)
    return json.dumps(response)

'''
Description: Retrieves the stored messages for the user specified by the passwd email address.
Input:
    token: A string containing the access token of the current user.
    email: The email address of the user to retrieve message for
Returned data: A text string containing all of the messages sent to the user.
'''
@app.route('/getusermessagesbyemail', methods=['GET','POST'])
def get_user_messages_by_email():
    token = request.json['token']
    email = database_helper.get_email_by_token(token)
    response = {}
    if email is None:
        response['success'] = False
        response['message'] = 'You are not signed in.'  
    else:
        response = get_message_with_email(request.json['email'])
    return json.dumps(response)

'''
Description: Tries to post a message to the wall of the user specified by the email address.
Input:
    token: A string containing the access token of the current user
    message: The message to post
    email: The email address of the recipient
Returned data: -
'''
@app.route('/postmessage', methods=['GET','POST'])
def post_message():
    response = {}
    data = request.json
    email = database_helper.get_email_by_token(data['token'])
    if email is None:
        response['success'] = False
        response['message'] = 'You are not signed in.'  
    else:
        message = data['message']
        target_email = data['email']
        if target_email == 'own':
            target_email = email
        if database_helper.check_user(target_email,'','exist'):
            database_helper.post_message(email, target_email,message)
            response['success'] = True
            response['message'] = 'Message posted'
            send_live_data()      
        else:
            response['success'] = False
            response['message'] = 'No such user.'   
        
    return json.dumps(response) 

@app.route('/testdata', methods=['GET','POST'])
def testdata(email=''):
    if email == '':
        data = request.json
        # email = data['email']
        email = 'hi@hi'
    response = {}
    response['total_user'] = database_helper.get_user_amount()
    response['online_user'] = check_online_users()
    response['user_view'] = database_helper.get_user_views(email)
    response['total_view'] = database_helper.get_total_views()
    response['max_user_view'] = database_helper.get_max_views()
    response['total_message'] = database_helper.get_message_total_amount()
    response['max_user_message'] = database_helper.get_message_max_amount()
    response['user_message'] = database_helper.get_message_amount(email)
        
    return response

@sockets.route('/socket')
def socket(ws):
    while True:
        t = ws.receive()
        print( t )
        print "new connection " + t
        if t in connected_users:
            print "not none"
            if not connected_users[t].closed:
                response = {}
                response['message'] = 'logout'
                connected_users[t].send(json.dumps(response))
                connected_users[t].close()
            connected_users[t] = ws
        else:
            print "add new socket"
            connected_users[t] = ws
        send_live_data()
    return

if __name__ == '__main__':
    server = pywsgi.WSGIServer(('', 5023), app, handler_class=WebSocketHandler)
    server.serve_forever()