from minargon import app
import os.path


# tell every template what front end it is in
@app.context_processor
def inject_front_end():
    return dict(front_end=app.config["FRONT_END"])

# filter to turn template into path
@app.template_filter("front_ended")
def front_ended_filter(string):
    return os.path.join(app.config["FRONT_END"], string)

@app.template_filter("common")
def common_filter(string):
    return os.path.join("common", string)


