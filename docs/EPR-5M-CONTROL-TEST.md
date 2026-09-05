# EPR 5M Control Test

## Objective

Prove that a serialised traveller cannot execute a controlled operation without the required Material, Man, Machine, Method and Measurement controls.

## Control chain

`Traveller → Operation → Qualified Operator → Equipment/Calibration → Approved Method → Parameter/Measurement → Audit`

## Test cases

1. **Man — qualification**
   - expired qualification must fail
   - suspended/revoked qualification must fail
   - inactive operator must fail
   - valid qualification must permit execution

2. **Machine — equipment**
   - unavailable equipment must fail
   - overdue calibration must fail when calibration is required
   - overdue maintenance must fail
   - available equipment must permit execution

3. **Method**
   - draft/superseded/blocked method must fail
   - approved future-effective method must fail before effective time
   - approved effective method must permit execution

4. **Measurement**
   - lower limit greater than upper limit must fail
   - a `pass` below lower limit must fail
   - a `pass` above upper limit must fail
   - fail/conditional results remain explicitly recorded

5. **Attribution**
   - controlled operation records operator, qualification, equipment and method
   - parameter records actual value, limits, unit and result
   - audit records the control event

6. **Genealogy**
   - operation control and process parameter records must be retrievable from the traveller/serial genealogy.

## Current status

The schema and server-side enforcement foundation are implemented in `main`. Actual Cloudflare database execution remains a runtime verification requirement. No physical manufacturing validation is implied by this software test.

## Benchmark basis

Mature EBR/eDHR systems link material, people, equipment, methods and measurements and support forward/backward traceability. Siemens explicitly describes these as the 5 Ms and includes operator signatures, equipment, process/exception records and parametric/quality data in lot traceability. citeturn0search2
