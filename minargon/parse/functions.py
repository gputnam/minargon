
class ParserFunctions(object):
    def __init__(self, redis_config):
        pass

    def range(self, *args):
        return range(*[int(x) for x in args])


