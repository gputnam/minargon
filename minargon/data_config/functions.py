
class ParserFunctions(object):
    def __init__(self, redis_config):
        pass

    def range(self, *args):
        return range(*[int(x) for x in args])

    def TPC_NCrate(self):
        return range(1)
    def TPC_NFEM(self, crate):
        return range(8)
    def TPC_NFEM_Channel(self, fem):
        return range(int(fem)*64, (int(fem)+1)*64)


