import hashlib
import json
import random
import time
import urllib2
import urllib
import ssl

class DataQuery:
    """ Supports simple user queries through the use of QueryEngine.
        (https://cdcvs.fnal.gov/redmine/projects/qengine/wiki)
    """

    def __init__(self, url):
        """ Class constructor.

            Args:
                 url - Http URL to QueryEngine.
        """
        self.url = url

    def query(self, database, table, columns, where=None, order=None, limit=None, echoUrl=False):
        """ Executes a simple query and returns the results in a list.  List data will
            be in the same order as listed in the columns attribute.

            Args:
                 database - The name of the database to be queried.  (This database must
                            be in QueryEngine's configuration file.)
                 table - The name of the table to query on.
                 columns - A comma separated string of the table columns to be returned.
                 where - (optional) <column>:<op>:<value> - can be repeated; seperated by ampersand (&)
                         op can be: lt, le, eq, ne, ge, gt
                 order - (optional) A comma separated string of columns designating row order in the returned list.
                         Start the string with a minus (-) for descending order.
                 limit - (optional) - A integer designating the maximum number of rows to be returned.
        """

        parameters = {
            'dbname' : database,
            't' : table,
            'c' : columns,
            'x' : 'no'
        }
        if where is not None:
            parameters['w'] = where
        if order is not None:
            parameters['o'] = order
        if limit is not None:
            parameters['l'] = limit
        fullUrl = self. url + '?' + urllib.urlencode(parameters)
        if echoUrl:
            print("Url: %s" % fullUrl)
        req = urllib2.Request(fullUrl)
        resp = urllib2.urlopen(req)
        text = resp.read()

        data = text.split('\n')
        return data[1:]
