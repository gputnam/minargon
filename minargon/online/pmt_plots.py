from minargon import app
import redis
from flask import send_file
import io
from minargon.metrics.online_metrics import redis_route
from minargon.metric.redis_api import get_streams

import plotly.graph_objects as go
from plotly.subplots import make_subplots
import numpy as np


@app.route('/<rconnect>/print_last')
#@app.route('/<pmt_heatmap>')
@redis_route
def binary(rconnect):
    # get the last value from the "example" stream and print it
    last = get_streams(rconnect, ["PMT:0:rms:30s"], n_data=1)
    print last

def pmt_heatmap():
    #Create fake data. Replace with real data ASAP
    #Rows refer to cluster and columns refer to Position address
    r1_data = np.random.randint(1800, size=(8,10))
    l1_data = np.random.randint(1800, size=(7,10))
    r2_data = np.random.randint(1800, size=(8,10))
    l2_data = np.random.randint(1800, size=(4,10))

    r1_on = np.size(r1_data,0)
    l1_on = np.size(l1_data,0)
    r2_on = np.size(r2_data,0)
    l2_on = np.size(l2_data,0)

    #Populate empty matricies for each heat map
    #First a set of matricies are created for where there are no PMTS
    r1_none = np.empty((5,45))
    r1_none[:] = np.nan
    l1_none = np.empty((5,45))
    l1_none[:] = np.nan
    r2_none = np.empty((5,45))
    r2_none[:] = np.nan
    l2_none = np.empty((5,45))
    l2_none[:] = np.nan

    #Next, the matricies where the data will go are created
    r1 = np.empty((5,45))
    r1[:] = np.nan
    l1 = np.empty((5,45))
    l1[:] = np.nan
    r2 = np.empty((5,45))
    r2[:] = np.nan
    l2 = np.empty((5,45))
    l2[:] = np.nan

    #Create a matrix to handle values for when a PMT is off
    r1_noData = np.empty((5,45))
    r1_noData[:] = np.nan
    l1_noData = np.empty((5,45))
    l1_noData[:] = np.nan
    r2_noData = np.empty((5,45))
    r2_noData[:] = np.nan
    l2_noData = np.empty((5,45))
    l2_noData[:] = np.nan

    #Create empty label vectors
    r1_labels = []
    l1_labels = []
    r2_labels = []
    l2_labels = []

    #set counters
    count = [0, 1, 2, 3, 4, 5, 6, 7, 8]
    i = 0
    j = 0
    k = 2
    l = 1
    layer = [1, 2, 3, 4, 5]

    #populate the matricies
    for x in layer:
        r1_labels.append([])
        l1_labels.append([])
        r2_labels.append([])
        l2_labels.append([])
        if (x%2 != 0):
            for y in count:
                if (y < r1_on):
                    r1[x - 1, j + 1] = r1_data[y, i]
                    r1[x - 1, j + 3] = r1_data[y, i + 1]
                    r1_labels[x - 1].append(None)
                    r1_labels[x - 1].append("Sector: 1R-" + str(y + 1) + "<br>Position: " + str(x + k + 3) + "<br>ADC Count: " + str(r1_data[y, i]))
                    r1_labels[x - 1].append(None)
                    r1_labels[x - 1].append("Sector: 1R-" + str(y + 1) + "<br>Position: " + str(x + k) + "<br>ADC Count: " + str(r1_data[y, i + 1]))
                    r1_labels[x - 1].append(None)
                else:
                    r1_noData[x - 1, j + 1] = 1
                    r1_noData[x - 1, j + 3] = 1
                    r1_labels[x - 1].append(None)
                    r1_labels[x - 1].append("Sector: 1R-" + str(y + 1) + "<br>Position: " + str(x + k + 3) + "<br>ADC Count: PMT OFF")
                    r1_labels[x - 1].append(None)
                    r1_labels[x - 1].append("Sector: 1R-" + str(y + 1) + "<br>Position: " + str(x + k) + "<br>ADC Count: PMT OFF")
                    r1_labels[x - 1].append(None)

                if (y < l1_on):
                    l1[x - 1, j + 1] = l1_data[y, i]
                    l1[x - 1, j + 3] = l1_data[y, i + 1]
                    l1_labels[x - 1].append(None)
                    l1_labels[x - 1].append("Sector: 1L-" + str(y + 1) + "<br>Position: " + str(x + k + 3) + "<br>ADC Count: " + str(l1_data[y, i]))
                    l1_labels[x - 1].append( None)
                    l1_labels[x - 1].append("Sector: 1L-" + str(y + 1) + "<br>Position: " + str(x + k) + "<br>ADC Count: " + str(l1_data[y, i + 1]))
                    l1_labels[x - 1].append(None)
                else:
                    l1_noData[x - 1, j + 1] = 1
                    l1_noData[x - 1, j + 3] = 1
                    l1_labels[x - 1].append(None)
                    l1_labels[x - 1].append("Sector: 1L-" + str(y + 1) + "<br>Position: " + str(x + k + 3) + "<br>ADC Count: PMT OFF")
                    l1_labels[x - 1].append( None)
                    l1_labels[x - 1].append("Sector: 1L-" + str(y + 1) + "<br>Position: " + str(x + k) + "<br>ADC Count: PMT OFF")
                    l1_labels[x - 1].append(None)

                if (y < r2_on):
                    r2[x - 1, j + 1] = r2_data[y, i]
                    r2[x - 1, j + 3] = r2_data[y, i + 1]
                    r2_labels[x - 1].append(None)
                    r2_labels[x - 1].append("Sector: 2R-" + str(y + 1) + "<br>Position: " + str(x + k + 3) + "<br>ADC Count: " + str(r2_data[y, i]))
                    r2_labels[x - 1].append( None)
                    r2_labels[x - 1].append("Sector: 2R-" + str(y + 1) + "<br>Position: " + str(x + k) + "<br>ADC Count: " + str(r2_data[y, i + 1]))
                    r2_labels[x - 1].append(None)
                else:
                    r2_noData[x - 1, j + 1] = 1
                    r2_noData[x - 1, j + 3] = 1
                    r2_labels[x - 1].append(None)
                    r2_labels[x - 1].append("Sector: 2R-" + str(y + 1) + "<br>Position: " + str(x + k + 3) + "<br>ADC Count: PMT OFF")
                    r2_labels[x - 1].append( None)
                    r2_labels[x - 1].append("Sector: 2R-" + str(y + 1) + "<br>Position: " + str(x + k) + "<br>ADC Count: PMT OFF")
                    r2_labels[x - 1].append(None)

                if (y < l2_on):
                    l2[x - 1, j + 1] = l2_data[y, i]
                    l2[x - 1, j + 3] = l2_data[y, i + 1]
                    l2_labels[x - 1].append(None)
                    l2_labels[x - 1].append("Sector: 2L-" + str(y + 1) + "<br>Position: " + str(x + k + 3) + "<br>ADC Count: " + str(l2_data[y, i]))
                    l2_labels[x - 1].append( None)
                    l2_labels[x - 1].append("Sector: 2L-" + str(y + 1) + "<br>Position: " + str(x + k) + "<br>ADC Count: " + str(l2_data[y, i + 1]))
                    l2_labels[x - 1].append(None)
                else:
                    l2_noData[x - 1, j + 1] = 1
                    l2_noData[x - 1, j + 3] = 1
                    l2_labels[x - 1].append(None)
                    l2_labels[x - 1].append("Sector: 2L-" + str(y + 1) + "<br>Position: " + str(x + k + 3) + "<br>ADC Count: PMT OFF")
                    l2_labels[x - 1].append( None)
                    l2_labels[x - 1].append("Sector: 2L-" + str(y + 1) + "<br>Position: " + str(x + k) + "<br>ADC Count: PMT OFF")
                    l2_labels[x - 1].append(None)

                r1_none[x - 1, j] = 1
                r1_none[x - 1, j + 2] = 1
                r1_none[x - 1, j + 4] = 1

                l1_none[x - 1, j] = 1
                l1_none[x - 1, j + 2] = 1
                l1_none[x - 1, j + 4] = 1

                r2_none[x - 1, j] = 1
                r2_none[x - 1, j + 2] = 1
                r2_none[x - 1, j + 4] = 1

                l2_none[x - 1, j] = 1
                l2_none[x - 1, j + 2] = 1
                l2_none[x - 1, j + 4] = 1

                j = j + 5
            k = k - 1
        else:
            for y in count:
                if (y < r1_on):
                    r1[x - 1, j] = r1_data[y, i]
                    r1[x - 1, j + 4] = r1_data[y, i + 1]
                    r1_labels[x - 1].append("Sector: 1R-" + str(y + 1) + "<br>Position: " + str(x - l + 8) + "<br>ADC Count: " + str(r1_data[y, i]))
                    r1_labels[x - 1].append(None)
                    r1_labels[x - 1].append(None)
                    r1_labels[x - 1].append(None)
                    r1_labels[x - 1].append( "Sector: 1R-" + str(y + 1) + "<br>Position: " + str(x - l) + "<br>ADC Count: " + str(r1_data[y, i + 1]))
                else:
                    r1_noData[x - 1, j] = 1
                    r1_noData[x - 1, j + 4] = 1
                    r1_labels[x - 1].append("Sector: 1R-" + str(y + 1) + "<br>Position: " + str(x - l + 8) + "<br>ADC Count: PMT OFF")
                    r1_labels[x - 1].append(None)
                    r1_labels[x - 1].append(None)
                    r1_labels[x - 1].append(None)
                    r1_labels[x - 1].append( "Sector: 1R-" + str(y + 1) + "<br>Position: " + str(x - l) + "<br>ADC Count: PMT OFF")

                if (y < l1_on):
                    l1[x - 1, j] = l1_data[y, i]
                    l1[x - 1, j + 4] = l1_data[y, i + 1]
                    l1_labels[x - 1].append("Sector: 1L-" + str(y + 1) + "<br>Position: " + str(x - l + 8) + "<br>ADC Count: " + str(l1_data[y, i]))
                    l1_labels[x - 1].append(None)
                    l1_labels[x - 1].append(None)
                    l1_labels[x - 1].append(None)
                    l1_labels[x - 1].append( "Sector: 1L-" + str(y + 1) + "<br>Position: " + str(x - l) + "<br>ADC Count: " + str(l1_data[y, i + 1]))
                else:
                    l1_noData[x - 1, j] = 1
                    l1_noData[x - 1, j + 4] = 1
                    l1_labels[x - 1].append("Sector: 1L-" + str(y + 1) + "<br>Position: " + str(x - l + 8) + "<br>ADC Count: PMT OFF")
                    l1_labels[x - 1].append(None)
                    l1_labels[x - 1].append(None)
                    l1_labels[x - 1].append(None)
                    l1_labels[x - 1].append( "Sector: 1L-" + str(y + 1) + "<br>Position: " + str(x - l) + "<br>ADC Count: PMT OFF")


                if (y < r2_on):
                    r2[x - 1, j] = r2_data[y, i]
                    r2[x - 1, j + 4] = r2_data[y, i + 1]
                    r2_labels[x - 1].append("Sector: 2R-" + str(y + 1) + "<br>Position: " + str(x - l + 8) + "<br>ADC Count: " + str(r2_data[y, i]))
                    r2_labels[x - 1].append(None)
                    r2_labels[x - 1].append(None)
                    r2_labels[x - 1].append(None)
                    r2_labels[x - 1].append( "Sector: 2R-" + str(y + 1) + "<br>Position: " + str(x - l) + "<br>ADC Count: " + str(r2_data[y, i + 1]))
                else:
                    r2_noData[x - 1, j] = 1
                    r2_noData[x - 1, j + 4] = 1
                    r2_labels[x - 1].append("Sector: 2R-" + str(y + 1) + "<br>Position: " + str(x - l + 8) + "<br>ADC Count: PMT OFF")
                    r2_labels[x - 1].append(None)
                    r2_labels[x - 1].append(None)
                    r2_labels[x - 1].append(None)
                    r2_labels[x - 1].append( "Sector: 2R-" + str(y + 1) + "<br>Position: " + str(x - l) + "<br>ADC Count: PMT OFF")

                if (y < l2_on):
                    l2[x - 1, j] = l2_data[y, i]
                    l2[x - 1, j + 4] = l2_data[y, i + 1]
                    l2_labels[x - 1].append("Sector: 2L-" + str(y + 1) + "<br>Position: " + str(x - l + 8) + "<br>ADC Count: " + str(l2_data[y, i]))
                    l2_labels[x - 1].append(None)
                    l2_labels[x - 1].append(None)
                    l2_labels[x - 1].append(None)
                    l2_labels[x - 1].append( "Sector: 2L-" + str(y + 1) + "<br>Position: " + str(x - l) + "<br>ADC Count: " + str(l2_data[y, i + 1]))
                else:
                    l2_noData[x - 1, j] = 1
                    l2_noData[x - 1, j + 4] = 1
                    l2_labels[x - 1].append("Sector: 2L-" + str(y + 1) + "<br>Position: " + str(x - l + 8) + "<br>ADC Count: PMT OFF")
                    l2_labels[x - 1].append(None)
                    l2_labels[x - 1].append(None)
                    l2_labels[x - 1].append(None)
                    l2_labels[x - 1].append( "Sector: 2L-" + str(y + 1) + "<br>Position: " + str(x - l) + "<br>ADC Count: PMT OFF")



                r1_none[x - 1, j + 1] = 1
                r1_none[x - 1, j + 2] = 1
                r1_none[x - 1, j + 3] = 1
                l1_none[x - 1, j + 1] = 1
                l1_none[x - 1, j + 2] = 1
                l1_none[x - 1, j + 3] = 1
                r2_none[x - 1, j + 1] = 1
                r2_none[x - 1, j + 2] = 1
                r2_none[x - 1, j + 3] = 1
                l2_none[x - 1, j + 1] = 1
                l2_none[x - 1, j + 2] = 1
                l2_none[x - 1, j + 3] = 1
                j = j + 5
            l = l + 1
        i = i + 2
        j = 0

    #Create subplots
    fig = make_subplots(4, 1)
    fig.add_trace(go.Heatmap(
        z=l1_none,
        colorscale = [[0, 'rgb(255,255,255)'], [1, 'rgb(255,255,255)']],
        showscale=False
            ),1, 1)
    fig.add_trace(go.Heatmap(
        z=l1_noData,
        colorscale = [[0, 'rgb(0,0,0)'], [1, 'rgb(0,0,0)']],
        showscale=False
            ),1, 1)
    fig.add_trace(go.Heatmap(
        z=l1,
        hovertext=l1_labels,
        hoverinfo="text",
        coloraxis = "coloraxis"
            ),1, 1)

    fig.add_trace(go.Heatmap(
        z=r1_none,
        colorscale = [[0, 'rgb(255,255,255)'], [1, 'rgb(255,255,255)']],
        showscale=False
        ),2, 1)
    fig.add_trace(go.Heatmap(
        z=r1_noData,
        colorscale = [[0, 'rgb(0,0,0)'], [1, 'rgb(0,0,0)']],
        showscale=False
            ),2, 1)
    fig.add_trace(go.Heatmap(
        z=r1,
        hovertext=r1_labels,
        hoverinfo="text",
        coloraxis = "coloraxis"
            ),2, 1)

    fig.add_trace(go.Heatmap(
        z=l2_none,
        colorscale = [[0, 'rgb(255,255,255)'], [1, 'rgb(255,255,255)']],
        showscale=False
            ),3, 1)
    fig.add_trace(go.Heatmap(
        z=l2_noData,
        colorscale = [[0, 'rgb(0,0,0)'], [1, 'rgb(0,0,0)']],
        showscale=False
            ),3, 1)
    fig.add_trace(go.Heatmap(
        z=l2,
        hovertext=l2_labels,
        hoverinfo="text",
        coloraxis = "coloraxis"
            ),3, 1)

    fig.add_trace(go.Heatmap(
        z=r2_none,
        colorscale = [[0, 'rgb(255,255,255)'], [1, 'rgb(255,255,255)']],
        showscale=False
            ),4, 1)
    fig.add_trace(go.Heatmap(
        z=r2_noData,
        colorscale = [[0, 'rgb(0,0,0)'], [1, 'rgb(0,0,0)']],
        showscale=False
            ),4, 1)
    fig.add_trace(go.Heatmap(
        z=r2,
        hovertext=r2_labels,
        hoverinfo="text",
        coloraxis = "coloraxis"
            ),4, 1)

    ticks = [2, 7, 12, 17, 22, 27, 32, 37, 42]

    fig.update_xaxes(tickmode = 'array',
        tickvals = ticks,
        ticktext = ['1L-9', '1L-8', '1L-7', '1L-6', '1L-5', '1L-4', '1L-3', '1L-2', '1L-1'],
        side='top',
        row=1,
        col=1)
    fig.update_xaxes(tickmode = 'array',
        tickvals = ticks,
        ticktext = ['1R-9', '1R-8', '1R-7', '1R-6', '1R-5', '1R-4', '1R-3', '1R-2', '1R-1'],
        side='top',
        row=2,
        col=1)
    fig.update_xaxes(tickmode = 'array',
        tickvals = ticks,
        ticktext = ['2L-9', '2L-8', '2L-7', '2L-6', '2L-5', '2L-4', '2L-3', '2L-2', '2L-1'],
        side='top',
        row=3,
        col=1)
    fig.update_xaxes(tickmode = 'array',
        tickvals = ticks,
        ticktext = ['2R-9', '2R-8', '2R-7', '2R-6', '2R-5', '2R-4', '2R-3', '2R-2', '2R-1'],
        side='top',
        row=4,
        col=1)

    fig.update_yaxes(showticklabels=False, row=1, col=1)
    fig.update_yaxes(showticklabels=False, row=2, col=1)
    fig.update_yaxes(showticklabels=False, row=3, col=1)
    fig.update_yaxes(showticklabels=False, row=4, col=1)

    fig.update_layout(title={
        'text': "PMT ADC Count",
        'y':0.95,
        'x':0.5,
        'xanchor': 'center',
        'yanchor': 'top'},
        coloraxis={'colorscale':[[0, "rgb(0,0,255)"],
        [0.5, "rgb(0,255,0)"],
        [1.0, "rgb(255,0,0)"]]})
    fig.show(config={
        'displayModeBar': False})
    sio = StringIO()
    fig.write_image(sio)
    sio.seek(0)
    return send_file(sio,mimetype="image/png")

