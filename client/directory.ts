import { usePaseo } from "@getpaseo/plugin/client";
import { useEffect, useState } from "react";

export type { PaseoWorkspace as Workspace, PaseoAgent as Agent } from "@getpaseo/client";
import type { PaseoWorkspace as Workspace, PaseoAgent as Agent } from "@getpaseo/client";
export const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);

export function useDirectory() {
  const paseo = usePaseo();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let disposed = false;
    const release: (() => Promise<void>)[] = [];
    setLoading(true);
    setError(null);
    setWorkspaces([]);
    setAgents([]);
    const workspaceMap = new Map<string, Workspace>();
    const agentMap = new Map<string, Agent>();
    const report = (value: unknown) => { if (!disposed) setError(errorText(value)); };

    const loadWorkspaces = async () => {
      const result = await paseo.workspaces.list({ page: { limit: 200 }, subscribe: {} });
      if (disposed) { await result.subscription.release(); return; }
      release.push(() => result.subscription.release());
      result.subscription.subscribe({
        snapshot: (snapshot) => {
          workspaceMap.clear();
          snapshot.entries.forEach((workspace) => workspaceMap.set(workspace.id, workspace));
          setWorkspaces([...workspaceMap.values()]);
          void (async () => {
            let cursor = snapshot.pageInfo.nextCursor;
            while (cursor && !disposed) {
              const page = await paseo.workspaces.list({ page: { limit: 200, cursor } });
              if (disposed) return;
              page.entries.forEach((workspace) => workspaceMap.set(workspace.id, workspace));
              setWorkspaces([...workspaceMap.values()]);
              cursor = page.pageInfo.nextCursor;
            }
          })().catch(report);
        },
        update: (message) => {
          if (disposed || message.type !== "workspace_update") return;
          const update = message.payload;
          if (update.kind === "upsert") workspaceMap.set(update.workspace.id, update.workspace);
          else workspaceMap.delete(update.id);
          setWorkspaces([...workspaceMap.values()]);
        },
        error: report,
      });
    };
    const loadAgents = async () => {
      const result = await paseo.agents.list({ filter: { includeArchived: false }, page: { limit: 200 }, subscribe: {} });
      if (disposed) { await result.subscription.release(); return; }
      release.push(() => result.subscription.release());
      result.subscription.subscribe({
        snapshot: (snapshot) => {
          agentMap.clear();
          snapshot.entries.forEach(({ agent }) => agentMap.set(agent.id, agent));
          setAgents([...agentMap.values()]);
          void (async () => {
            let cursor = snapshot.pageInfo.nextCursor;
            while (cursor && !disposed) {
              const page = await paseo.agents.list({ filter: { includeArchived: false }, page: { limit: 200, cursor } });
              if (disposed) return;
              page.entries.forEach(({ agent }) => agentMap.set(agent.id, agent));
              setAgents([...agentMap.values()]);
              cursor = page.pageInfo.nextCursor;
            }
          })().catch(report);
        },
        update: (message) => {
          if (disposed || message.type !== "agent_update") return;
          const update = message.payload;
          if (update.kind === "upsert") agentMap.set(update.agent.id, update.agent);
          else agentMap.delete(update.agentId);
          setAgents([...agentMap.values()]);
        },
        error: report,
      });
    };
    void Promise.all([loadWorkspaces(), loadAgents()])
      .catch(report).finally(() => { if (!disposed) setLoading(false); });
    return () => {
      disposed = true;
      release.forEach((close) => { void close().catch(() => {}); });
    };
  }, [paseo, revision]);

  return { workspaces, agents, error, loading, retry: () => setRevision((value) => value + 1) };
}
