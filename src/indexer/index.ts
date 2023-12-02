import { SupabaseClient, createClient } from "@supabase/supabase-js";
import { MethodStatuses } from "../types/results.js";
import { PriorityIndexingResult } from "../index.js";

export class OrbisNodeClient {
  #client: SupabaseClient;
  #host: string;
  #api: string;

  constructor({ api, host, key }: { api: string; host: string; key: string }) {
    this.#host = host.replace(/\/$/, "");
    this.#api = api;
    this.#client = createClient(this.#host, key);
  }

  get client(): SupabaseClient {
    return this.#client;
  }

  async priorityIndex({
    resource,
  }: {
    resource: { id: string; type: "profile" | "document" };
  }): Promise<PriorityIndexingResult> {
    const url = `${this.#api}/index-${
      resource.type === "profile" ? "orbis-did" : "stream/mainnet"
    }/${resource.id}`;
    try {
      const result = await fetch(url);
      const serverResponse = await result.json();

      const {
        status,
        error: indexingError,
        result: indexingResult,
      } = serverResponse;

      if (status === 200) {
        return {
          status: MethodStatuses.ok,
          result: indexingResult,
          serverResponse,
        };
      }

      return {
        status: MethodStatuses.genericError,
        error: indexingError || indexingResult || status,
        serverResponse,
      };
    } catch (e: any) {
      return {
        status: MethodStatuses.genericError,
        serverResponse: null,
        error: e.message,
      };
    }
  }

  async priorityIndexDocument({ id }: { id: string }) {
    return this.priorityIndex({ resource: { type: "document", id } });
  }

  async priorityIndexProfile({ did }: { did: string }) {
    return this.priorityIndex({ resource: { type: "profile", id: did } });
  }
}
