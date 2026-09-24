# P1S squash-ball foot — P02

P02 incorporates the operator's extra 3 mm travel and the isolation review.
Two TPU pieces per foot; four feet per printer. All CAD dimensions are mm.

## Changes from P01

- Outer diameter remains 80 mm. Seat height increases from 14 to 17 mm.
- Unloaded cup-to-stop gap increases from 9 to 12 mm.
- TPU envelope is 80 × 32.333 mm; including a seated 40 mm ball, total height
  is 59 mm before deflection. Cup depth remains 13.333 mm.
- Six identical 20° curved ribs replace the three unequal opposing pairs.
  Ribs are 4.0 mm wide × 8.8 mm deep, compatible with 0.2 mm layers.
- The model's horizontal principal stiffnesses change from 11.31/16.79 N/mm
  to 13.66/13.66 N/mm at E=9.8 MPa. This is more uniform, not softer in every
  direction. Vertical stiffness is essentially unchanged: 14.25 vs 14.20 N/mm.

## What the optimization establishes

3,444 equal-rib geometries were screened. 63 first-feasible candidates were
compared over 1,944 combinations of printer mass, TPU static modulus, dynamic
stiffening, ball stiffness and material loss. The plotted range is 0.5–200 Hz.
The explicitly chosen scoring band is 30–100 Hz, with flat, equal uncorrelated
forcing power in X/Y/Z. This is a surrogate, not the measured printer spectrum.

P02's worst-case integrated score differs from P01 by approximately +0.02 dB
(slightly worse). That is negligible relative to the model's uncertainty.
The revision improves travel reserve and horizontal uniformity; no meaningful
overall silencing improvement over P01 is claimed. A passive suspension cannot
attenuate all frequencies: it carries static load and can amplify near resonance.

The comparison model uses two masses per foot: 1/4 of the printer and a
hypothetical 20 g moving cup/rib mass, separated by the ball. The base is fixed.
Complex spring stiffness k*(1+i*loss_factor) represents a constant material loss
over the illustrated band. This is different from the original viscous-damping
SDOF illustration. Actual frequency-dependent stiffness/loss, local flexible
part modes, a flexible table and its sound radiation are not represented.

## Clearance and load

At E=9.8 MPa and equally shared 12.95 kg printer mass: 31.75 N/foot, 2.23 mm
initial sag, 9.77 mm remaining stop clearance. For the 20 kg illustrative setup,
a 30% heavily loaded corner, E=7.4 MPa and a hypothetical 1.5× sag drift:
5.92 mm initial sag, 8.89 mm drifted sag, 3.11 mm remaining clearance.

7.4 MPa is a provisional design low end, not a guaranteed lower bound for an
unknown TPU. The 5 MPa upset case retains 3.23 mm initially but reaches the stop
under the same 1.5× sag multiplier (linear extrapolation: −1.15 mm clearance).
It therefore fails the reserve requirement. At that stiffness the same ribs
would need about 21.16 mm seat height (36.49 mm TPU envelope), or approximately
11 mm rib depth at the present 17 mm seat, to recover 3 mm in this linear model.
Those alternatives are not supplied as validated designs.

The severe 7.4 MPa case predicts approximately 22% nominal bending strain and
large deflection. Linear elasticity is a weak approximation there. The 3.11 mm
result is a model-based screening margin, NOT a proof of clearance in a print.
Sag multipliers of 1.5 and 2 are stress tests, not a calibrated creep law.

## Does the ball help?

In series, compliance adds: 1/k_total = 1/k_ball + 1/k_foot. The ball generally
lowers the primary resonance, but changes contact geometry and the resonant
response. A ball already very soft compared with the foot dominates the total
compliance, so adding TPU beneath it offers a smaller incremental benefit.

For illustrative ball stiffnesses of 5/20/100 N/mm, at 50 Hz, E=9.8 MPa,
12.95 kg and assumed loss factor 0.30 for both springs, adding the ball to the
TPU foot changes transmitted force by about −11.1/−4.3/−1.1 dB. Adding the
foot to balls alone changes it by about −1.8/−7.5/−20.8 dB. These are force
ratios from a hypothetical model, not microphone sound reduction. Near the
new resonance some frequencies get worse. Cradling the ball can also change
its effective stiffness relative to a bare ball on a table; these comparisons
hold ball stiffness fixed and do not capture that contact change.

## Print and assembly

Print base.stl and cradle.stl in their exported orientations, with the flat sides
on the bed. The geometry is designed without support or enclosed bridges.
Use a 0.4 mm nozzle, 0.2 mm layers, at least four perimeters and 100% infill to
match the solid-rib analysis. Inspect the slicer for filled ribs, connected roots
and elephant-foot interference. Use the filament manufacturer's settings.

Place the cradle ring on the base shoulder. The socket has 0.25 mm radial
clearance, is gravity-seated, and does not lock. Place the ball in the bowl.
Lift by the base. Check the existing upper ball holder and all nearby geometry
through the available travel. Stop, cup, ribs and upper holder must not create
an unintended contact path. Check the locating joint for shifting under motion.

## Validation still required

1. Measure the actual ball diameter, TPU grade and heaviest printer corner load.
2. Test one assembled foot through the actual ball. Record cup underside height
   before loading, after 1 minute, 1 hour and 24 hours at service temperature.
   Retain at least 3 mm stop clearance after settling. Do not treat the assumed
   creep factors as a lifetime limit.
3. Measure small load increments around the operating load to estimate tangent
   stiffness of the ball and TPU separately. A whole-load secant stiffness is
   not automatically the vibration stiffness.
4. Compare balls alone and balls + P02 using the same printer motion, fan state,
   table location and sensor mounting. Inspect table and floor acceleration
   spectra, printer rocking, layer quality and locating-joint motion. Repeat.
   A microphone can document sound, but force-transmission dB is not SPL dB.
5. Check for cable tension, enclosure/table contact, a loaded stop or an upper
   holder touching the base. These can bypass the suspension.

The exploratory rigid-printer model produces coupled rocking/sway modes around
2–5 Hz across hypothetical ball stiffnesses. Foot spacing (320 mm), center-of-
mass height (230 mm), mass distribution and ball lateral stiffness are assumed,
not measured P1S properties. Physical rocking stability remains unverified.

## Reproduce

Install requirements.txt in a Python virtual environment, then:

```sh
python analyze.py
python build.py
```

The separate review-source.zip includes the 3D frame and optimization scripts,
input dimensions, exact dependency versions and saved reports. The beam model
is verified against analytical straight-beam solutions, independently agrees
with P01's vertical stiffness, and is checked with finer centerline meshes.
CAD validation checks single valid solids, connected watertight STLs and no
unloaded assembly interference. No nonlinear solid FEA, slicing test, physical
print test or acoustic validation is claimed.

## Reference sources

- [Bambu P1S net mass](https://store.bblcdn.com/63ec128d3b8f4f32b7d60fe4dd112ed3.pdf)
- [Bambu TPU 95A HF data](https://store.bblcdn.com/s6/default/a6ca55f14aa54ddb92679d06df4700ae/Bambu_TPU_95A_HF_Technical_Data_Sheet.pdf)
- [NinjaTek Cheetah 95A data](https://ninjatek.com/wp-content/uploads/Cheetah-TDS.pdf)
- [Newport vibration-control fundamentals](https://www.newport.com.cn/n/vibration-control-fundamentals/)

The review report distinguishes manufacturer reference inputs from hypothetical
sensitivity cases. These sources do not validate this foot or its ball contact.
