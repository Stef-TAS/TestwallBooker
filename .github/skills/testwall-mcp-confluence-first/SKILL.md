---
name: testwall-mcp-confluence-first
description: Use when answering TTTech Testwall API help requests. Resolve relevant testwall scope through Confluence MCP first, then use Testwall MCP to provide accurate command explanations and copyable Python examples.
user-invocable: true
argument-hint: Describe the hardware task and include testwall or DUT name if known.
---

# Testwall MCP Confluence-First Workflow

This skill is for guide-only support. It does not execute code.

## Goals

- Identify the right testwall scope before API lookup.
- Validate feasibility and capability for the requested action.
- Return complete, copyable code snippets with clear sequencing.
- Prevent guessed API calls by constraining examples to verified method patterns.

## Required Order

1. Resolve scope with Confluence MCP.
2. Verify capability and wiring facts.
3. Query Testwall MCP for API guidance and exact command flow.
4. Return the final explanation and code.

## Scope Resolution Logic

Use this decision path for each prompt:

1. If exactly one testwall is clearly named:
   - Continue with that testwall.
2. If multiple testwalls are named or implied:
   - Confirm whether the user wants one testwall or all matching testwalls.
3. If no testwall is given:
   - Ask which testwall they are using before API steps.

If testwall names are given but the request intent (single vs all) is ambiguous, do not emit code until clarified.

## Testwall MCP Calls

Use these calls as needed after scope is clear:

- `list_testwalls` for inventory matching.
- `list_duts` to enumerate DUT candidates.
- `get_dut` for DUT wiring, relays, waldies, CAN, and power facts.
- `get_testwall` for shared infrastructure and lane capabilities.
- `get_api_guide` for operation-specific API call order and pitfalls.

If MCP is unavailable, explicitly report `needs clarification` or `unsupported` (based on what is blocked) and ask whether the user wants a best-effort template snippet with placeholders.

## Capability Validation Rules

- If requested behavior is unsupported, say it explicitly and explain what is missing.
- If supported, provide only the minimal correct sequence.
- Preserve strict operation order for sensitive flows, especially waldie config:
  - config mode
  - configure
  - activate settings

Before finalizing code, run this quick consistency check:

1. Object construction uses `from ttctw_api import TestBed, DeviceUnderTest`, `testbed = TestBed()`, and `dut = DeviceUnderTest(testbed, DUT_NAME)`.
2. Method names are from known valid patterns (`set_voltage`, `set_current`, `set_output`, `switch`, `can_connect`, `waldie_set_voltage`, `set_waldies_into_config_mode`, `activate_waldies_settings`).
3. No guessed aliases (`get_dut`, `get_device`, `output_on`, `output_off`, `set_can_connection`).
4. No invented `TestBed` kwargs (`host`, `user`, `password`, `testwall`) unless verified from MCP guidance.
5. For waldie updates, default to testbed-level config mode and activation wrappers unless a per-pin flow is explicitly required and fully specified.

## Response Structure

Use the template from [references/response-template.md](./references/response-template.md).

Always include:

1. Scope summary.
2. Capability conclusion.
3. Complete Python code block.
4. Preconditions and substitutions the user must set.
5. Why ordering matters.

When feasibility is `needs clarification`, include focused questions under section 4 instead of runnable values.
