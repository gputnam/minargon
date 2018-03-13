#!/usr/bin/env python
from setuptools import setup
from glob import glob

setup(name='minargon',
      version='1.0',
      description='Web App Monitoring Tools',
      author='Anthony LaTorre',
      author_email='tlatorre@uchicago.edu',
      url='snopl.us',
      packages=['minard','snoplus_log'],
      include_package_data=True,
      zip_safe=False,
      scripts=glob('bin/*'),
      install_requires=['flask==0.10',
                        'gunicorn',
                        'numpy',
                        'pyzmq',
                        'redis>=2.10',
                        'argparse',
                        'sphinx',
                        'requests',
                        'sqlalchemy',
                        'psycopg2',
                        'alabaster',
                        'couchdb']
      )
