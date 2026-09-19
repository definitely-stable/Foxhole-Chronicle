# Foxhole Chronicle — Data Licensing and Source-Use Policy

Status: **Authoritative working policy**

This document defines whether Chronicle may ingest, retain, transform and redistribute data from external sources.

It is an engineering policy, not legal advice. Where permission cannot be verified, Chronicle MUST take the conservative path.

## 1. Source classes

### Official Foxhole / War API

Role: primary source for current/future public war state.


### FoxholeStats

Role: candidate historical bootstrap source only.


### FoxholeHub

Role: candidate historical bootstrap source only.

Default policy is the same: disabled until source-use review is complete.

## 2. Runtime dependency rule

Chronicle MUST remain operational for current-war collection without FoxholeStats or FoxholeHub.

Historical sources MAY enrich the archive, but page rendering MUST read Chronicle-owned normalized data after an approved import.

