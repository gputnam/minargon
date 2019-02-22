from minargon import app
from flask import render_template, jsonify, request, redirect, url_for, flash

"""
	Routes intented to be seen by the user	
"""

@app.route('/')
def index():
    return redirect(url_for('introduction'))

@app.route('/introduction')
def introduction():
    return render_template('introduction.html')
