import sqlite3
from flask import Flask, request, session, g, redirect, url_for, \
     abort, render_template, flash
from contextlib import closing
import hashlib, binascii

# configuration
DATABASE = 'database.db'
# create our little application :)
app = Flask(__name__)
app.config.from_object(__name__)

def connect_db():
    """Connects to the specific database."""
    rv = sqlite3.connect(app.config['DATABASE'])
    rv.row_factory = sqlite3.Row
    return rv
# def close_db():
#Implementation hidden 

def get_db():
    """Opens a new database connection if there is none yet for the
    current application context.
    """
    if not hasattr(g, 'sqlite_db'):
        g.sqlite_db = connect_db()
    return g.sqlite_db

def check_user(email, password, check=''):
    db = get_db()
    cur = ''
    cur = db.execute("select password, salt from userInfo where email = ?", [email]) 
    exist = cur.fetchall()
    if exist is None:
            return False
    elif len(exist) > 0:
        if check == 'exist':
            return True
        salt = exist[0]['salt']
        dpassword = exist[0]['password']
        hpassword = binascii.hexlify(hashlib.pbkdf2_hmac('sha256', str(password), str(salt), 100000))
        if dpassword == hpassword:
            return True
        return False
    return False
    
    
def get_info_by_email(email, from_):
    db = get_db()
    cur = db.execute('select email, firstname, familyname, gender, city, country from userInfo where email = ?', [email])
    rows = cur.fetchall()
    if len(rows) > 0:
        if from_ == 'other':
            db.execute('update userInfo set pageview = pageview + 1 where email = ?', [email]);
            db.commit()
        return rows[0]    
    return None

def get_email_by_token(token):
    db = get_db()
    cur = db.execute('select email from users where token = ?', [token])
    ls = cur.fetchall()
    if len(ls) > 0:
        infos = ls[0]['email']    
    else:
        infos = None
    return infos    

def get_token_by_email(token):
    db = get_db()
    cur = db.execute('select token from userInfo where email = ?', [email])
    token = cur.fetchall()[0]
    return token

def store_new_token(email, token):
    db = get_db()
    db.execute('insert or replace into users (id, email, token) \
        values ((select id from users where email = ?),?,?);', (email, email, token))
    db.commit()

def delete_token(token):
    db = get_db()
    db.execute('delete from users where token = ?', [token])
    db.commit()    

def update_password(email, password, salt):
    db = get_db()
    db.execute('update userInfo set password = ?, salt = ? where email = ?', (password, salt, email))
    db.commit()


def insert_user(infos):
    db = get_db()
    db.execute('insert into userinfo (email, password, salt, firstname, familyname, gender, city, country) \
                            values (?, ?, ?, ?, ?, ?, ?, ?)', infos)
    db.commit()
    return 'insert testing value'



def get_messages(email):
    db = get_db()
    cur = db.execute('select content, fromemail from messages where toemail = ?', [email])
    rv = cur.fetchall()
    if rv is None:
        return None
    else:
        message_list = []
        for m in rv:
            message = {}
            message['writer'] = m['fromemail']
            message['content']  = m['content']
            message_list.append(message)
        return message_list

def post_message(email, target_email, message): 
    db = get_db()
    cur = db.execute('insert into messages (fromemail, toemail, content)\
                    values (?, ?, ?)', (email, target_email, message))
    db.commit()
    db.execute('update userInfo set messages = messages + 1 where email = ?', [target_email])
    db.commit()

# live data part
def get_user_amount():
    db = get_db()
    cur = db.execute('select max(id) as amount from userInfo')
    rv = cur.fetchall()
    if rv is None:
        return 0
    else:
        return rv[0]['amount']    

def get_user_views(email):
    db = get_db()
    cur = db.execute('select pageview as views from userInfo where email=?', [email])
    rv = cur.fetchall()
    if rv is None:
        return 0
    else:
        return rv[0]['views']    

def get_total_views():
    db = get_db()
    cur = db.execute('select sum(pageview) as views from userInfo')
    rv = cur.fetchall()
    if rv is None:
        return 0
    else:
        return rv[0]['views']    

def get_max_views():
    db = get_db()
    cur = db.execute('select max(pageview) as views from userInfo')
    rv = cur.fetchall()
    if rv is None:
        return 0
    else:
        return rv[0]['views']    

def get_message_amount(email):
    db = get_db()
    cur = db.execute('select messages as amount from userInfo where email = ?', [email])
    rv = cur.fetchall()
    if rv is None:
        return 0
    else:
        return rv[0]['amount']        


def get_message_total_amount():
    db = get_db()
    cur = db.execute('select max(id) as amount from messages')
    rv = cur.fetchall()
    if rv is None:
        return 0
    else:
        return rv[0]['amount']                

def get_message_max_amount():
    db = get_db()
    cur = db.execute('select max(messages) as amount from userInfo')
    rv = cur.fetchall()
    if rv is None:
        return 0
    else:
        return rv[0]['amount']        


@app.before_request
def before_request():
    g.db = connect_db()

@app.teardown_request
def teardown_request(exception):
    db = getattr(g, 'db', None)
    if db is not None:
        db.close()

def init_db():
    with closing(connect_db()) as db:
        with app.open_resource('database.schema', mode='r') as f:
            db.cursor().executescript(f.read())
        db.commit()