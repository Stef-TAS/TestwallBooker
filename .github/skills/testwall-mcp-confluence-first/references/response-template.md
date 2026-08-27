# Response Template

Use this exact shape for final user replies.

## 1) Scope

- Testwall: <name or "all matching testwalls">
- DUT: <name if relevant>
- Requested operation: <short summary>

## 2) Feasibility

- Status: <supported | unsupported | needs clarification>
- Reason: <capability/wiring explanation>

## 3) Copyable Python Example

```python
from ttctw_api import TestBed, DeviceUnderTest

DUT_NAME = "<dut_name>"

testbed = TestBed()  # Optional: set location/logger arguments if your setup requires it.
dut = DeviceUnderTest(testbed, DUT_NAME)

# Replace placeholders with values validated from MCP lookups.
# Keep operation order exactly as shown.

<api_call_sequence>
```

## 4) Required Inputs

- <placeholder_1>
- <placeholder_2>
- <placeholder_3>

## 5) Why This Order

- <short ordering rationale>
