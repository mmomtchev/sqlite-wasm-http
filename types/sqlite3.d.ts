import { Promiser } from "./sqlite3-promiser";

export { };

declare global {
  var sqlite3Worker1Promiser: (config: Promiser.PromiserConfig) => Promiser.Promiser;
}