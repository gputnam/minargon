from minargon import app
from flask import jsonify, request, render_template, abort


# custom error handler for database connection fail
@app.errorhandler(503)
def custom503(error):
    render_args = {
      "database_name": error.description.database_name(),
      "description": error.description.message()
    }

    # render page for abort coming from front end
    if error.description.front_end_abort:
        render_args["description"].replace("\n", "<br>")
        return render_template('error/503.html', **render_args), 503
    # otherwise return JSON info
    else:
        return jsonify(**render_args), 503
