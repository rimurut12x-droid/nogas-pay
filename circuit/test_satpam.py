import os, sys, unittest

sys.path.insert(0, os.path.dirname(__file__))
import reference as ref  # noqa: E402
import satpam  # noqa: E402


def bits(amt, day, refuel, first):
    return amt | (day << 2) | (refuel << 4) | (first << 5)


def out(allow, tier):
    return allow | (tier << 1)


class SatpamTest(unittest.TestCase):
    def test_shape(self):
        self.assertEqual((satpam.N_IN, satpam.N_OUT), (6, 3))

    def test_rules(self):
        s = satpam.satpam_spec
        self.assertEqual(s(bits(3, 0, 0, 0)) & 1, 0)          # over limit
        self.assertEqual(s(bits(0, 3, 0, 0)) & 1, 0)          # daily > 10
        self.assertEqual(s(bits(1, 0, 1, 0)) & 1, 0)          # refuel only small
        self.assertEqual(s(bits(0, 0, 0, 1)), out(1, 0))      # first time, small, send: free
        self.assertEqual(s(bits(0, 0, 0, 0)), out(1, 1))      # small send
        self.assertEqual(s(bits(1, 2, 0, 0)), out(1, 1))      # medium send
        self.assertEqual(s(bits(2, 1, 0, 0)), out(1, 2))      # large send
        self.assertEqual(s(bits(2, 0, 0, 1)), out(1, 2))      # first time but large: not free
        self.assertEqual(s(bits(0, 0, 1, 0)), out(1, 1))      # refuel small
        self.assertEqual(s(bits(0, 0, 1, 1)), out(1, 1))      # refuel never free

    def test_netlist_well_formed_nand_only(self):
        nl = satpam.build_netlist()
        els = ref.decode(nl, satpam.N_IN)
        self.assertTrue(all(e.op == ref.NAND for e in els))
        c = ref.load(nl, satpam.N_IN, satpam.N_OUT)
        self.assertEqual(c.n_state, 0)

    def test_truth_table(self):
        c = ref.load(satpam.build_netlist(), satpam.N_IN, satpam.N_OUT)
        for x in range(64):
            _, o = ref.beat(c, [], ref.unpack(bytes([x]), satpam.N_IN))
            got = int.from_bytes(ref.pack(o), "little")
            self.assertEqual(got, satpam.satpam_spec(x), f"input {x:06b}")


if __name__ == "__main__":
    unittest.main()
