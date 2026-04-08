import { buildLogWhispererConfigFromEnv, LogWhispererShipper } from './logWhispererShipper';

const logWhispererConfig = buildLogWhispererConfigFromEnv();

export const logShipper = new LogWhispererShipper(logWhispererConfig);

export { buildLogWhispererConfigFromEnv, LogWhispererShipper } from './logWhispererShipper';
