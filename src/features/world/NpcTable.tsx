import { TableVirtuoso } from "react-virtuoso";
import { WonderkidTags } from "./WonderkidTags";
import { getCountry } from "@/data/world/countries";
import { NpcAvatar } from "@/components/game/NpcAvatar";
import type { Npc } from "@/types";
import { useSave } from "@/hooks/useGame";
import { useNpcs } from "@/hooks/useNpcs";
import {
  npcDirectoryRank,
  playerDirectoryEntry,
} from "@/game/social/directory";

interface NpcTableProps {
  npcs: Npc[];
  showRank?: boolean;
  onSelect?: (npc: Npc) => void;
}

export function NpcTable({ npcs, showRank = false, onSelect }: NpcTableProps) {
  const save = useSave(),
    world = useNpcs();
  const playerRank = playerDirectoryEntry(save, world).worldRank;
  const cells = (npc:Npc) => (<>
              {showRank && (
                <td className="py-2.5 pr-2 tabular-nums text-ink-muted">
                  {npcDirectoryRank(npc, playerRank) ?? "–"}
                </td>
              )}
              <td className="py-2.5 pr-2 font-semibold text-ink">
                <div className="flex items-center gap-2">
                  <NpcAvatar npc={npc} decorative />
                  <div className="min-w-0">
                    {onSelect ? (
                      <button
                        type="button"
                        onClick={() => onSelect(npc)}
                        className="text-left underline-offset-2 hover:text-gold-300 hover:underline"
                      >
                        <span translate="no">{npc.name}</span>
                      </button>
                    ) : (
                      <span translate="no">{npc.name}</span>
                    )}
                    {npc.title !== "none" && (
                      <span className="ml-2 text-xs font-medium text-gold-500">
                        {npc.title}
                      </span>
                    )}
                    <WonderkidTags id={npc.id}/>
                  </div>
                </div>
              </td>
              <td className="py-2.5 pr-2 text-ink-muted">
                <span aria-hidden>{getCountry(npc.nationality)?.flag}</span>{" "}
                {getCountry(npc.nationality)?.name ?? npc.nationality}
              </td>
              <td className="py-2.5 text-right font-semibold tabular-nums text-gold-400">
                {npc.currentElo}
              </td>
            </>);
  const header = () => <tr className="border-b border-white/10">{showRank&&<th className="p-2 text-left">Rank</th>}<th className="p-2 text-left">Player</th><th className="p-2 text-left">Country</th><th className="p-2 text-right">Elo</th></tr>;
  if(npcs.length>80)return <TableVirtuoso style={{height:560}} data={npcs} overscan={200} computeItemKey={(_,npc)=>npc.id} components={{Table:props=><table {...props} className="w-full min-w-[380px] text-sm"/>,TableHead:props=><thead {...props} className="bg-navy-800 text-ink-faint"/>}} fixedHeaderContent={header} itemContent={(_,npc)=>cells(npc)}/>;
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-ink-faint">{header()}</thead><tbody>{npcs.map(npc=><tr key={npc.id} className="border-b border-white/5">{cells(npc)}</tr>)}</tbody></table></div>;
}
