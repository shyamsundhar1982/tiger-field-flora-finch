import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ca = await readFile(new URL('../src/lib/vibpe-ca-financial-planner.ts', import.meta.url), 'utf8');
const ride = await readFile(new URL('../src/lib/vibpe-cycling-performance.ts', import.meta.url), 'utf8');
const fit = await readFile(new URL('../src/lib/vibpe-bike-fit-india.ts', import.meta.url), 'utf8');
const carbon = await readFile(new URL('../src/lib/vibpe-carbon-bike-designer.ts', import.meta.url), 'utf8');

test('CA layer separates accounting, tax and cash and forbids automatic filings', () => {
  assert.match(ca, /Separate accounting recognition, tax treatment and cash timing/);
  assert.match(ca, /Never post a journal, tax return, challan/);
  assert.match(ca, /AS and Ind AS/);
});

test('ride analytics supports FTP, VO2max, SpO2 and workload with medical safety boundary', () => {
  assert.match(ride, /ftpW/);
  assert.match(ride, /vo2MaxMlKgMin/);
  assert.match(ride, /spo2Percent/);
  assert.match(ride, /not medical diagnoses/);
});

test('Indian bike-fit layer does not size from height alone', () => {
  assert.match(fit, /Do not derive frame size from height alone/);
  assert.match(fit, /Direct rider measurements override population priors/);
  assert.match(fit, /stack, reach, standover/);
});

test('carbon designer does not convert fibre datasheets into released ply books', () => {
  assert.match(carbon, /not laminate or structural design allowables/);
  assert.match(carbon, /Production ply books require validated laminate allowables/);
});
