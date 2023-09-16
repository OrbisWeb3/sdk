import fs from "fs";
import path from "path";
import * as url from "url";

import { compile } from "json-schema-to-typescript";

import { CeramicStorage } from "../src/storage/index.js";
import { OrbisSchemas } from "../src/types/primitives/index.js";
import { defaultConfig } from "../src/util/config.js";

const schemaDirectory = url.fileURLToPath(
  new URL("../src/types/primitives", import.meta.url)
);
const storage = new CeramicStorage({ gateway: defaultConfig.storage.gateway });

let comment = false;
let file = "";

for (const [k, v] of Object.entries(OrbisSchemas)) {
  console.log("Fetching schema for", k);
  const document = await storage.getDocument(v.commit);
  if ("error" in document) {
    console.log("Error generating schema for", k);
    continue;
  }

  file += await compile(document.content, `${document.content.title}Schema`, {
    ...((comment && { bannerComment: "" }) || {}),
  });
  file += "\n";
  comment = true;
  console.log("Generated types for", k);
}

fs.writeFileSync(path.resolve(schemaDirectory, "schemas.ts"), file);
