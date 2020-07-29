from minargon import app
from flask import jsonify, request, render_template, abort
from werkzeug.exceptions import NotFound


# custom error handler for database connection fail
@app.errorhandler(503)
def custom503(error):
    render_args = {
      "database": True,
      "database_name": error.description.database_name(),
      "description": error.description.message(),
      "code": 503,
    }

    # render page for abort coming from front end
    if error.description.front_end_abort:
        render_args["description"].replace("\n", "<br>")
        return render_template('error/error.html', **render_args), 503
    # otherwise return JSON info
    else:
        return jsonify(**render_args), 503

@app.errorhandler(404)
def custom404(error):
    render_args = dict(code=404)
    # standard error handler
    if isinstance(error.description, str):
        render_args["database"] = False
        render_args["description"] = error.description
        render = True
    # database error handler
    else:
        render_args["database"] = True
        render_args["database_name"] = error.description.name
        render_args["description"] = error.description.msg
        render = error.description.front_end_abort

    if render:
        return render_template('error/error.html', **render_args), 404
    else:
        return jsonify(**render_args), 404

