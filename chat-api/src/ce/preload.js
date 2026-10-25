/**
 * CE boot preload — run via `node --import ./src/ce/preload.js server.js`.
 *
 * Loads dotenv then fail-if-paid-linked (Stripe / PLAID_ / GITHUB_TOKEN) when CE_BUILD is set.
 * Route-level CE rejects are applied in requireAuth (and rejectPaidCapability).
 *
 * Kept out of the 385KB server.js body so Phase 1a stays a surgical diff;
 * behavior matches "call assertPaidNotLinked early after dotenv".
 */
import dotenv from 'dotenv';
dotenv.config();

import { assertPaidNotLinked } from './ce-build.js';

assertPaidNotLinked();
