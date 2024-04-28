import { createDroppable } from "@thisbeyond/solid-dnd";
import { DirEntity } from "../../types";

export function DroppableRow(props: { onChangeDir: (entry: DirEntity) => Promise<void> }) {
  const droppable = createDroppable("..");
  return (
    <tr
      ref={droppable}
      onDblClick={(e: any) => {
        e.stopPropagation()
        e.preventDefault()
        props.onChangeDir({ name: "..", path: "", file_type: "symbol" } as DirEntity)
      }}
      onKeyUp={(e: any) => {
        e.stopPropagation()
        e.preventDefault()
        if (e.keyCode == 13) {
          props.onChangeDir({ name: "..", path: "", file_type: "symbol" } as DirEntity)
        }
      }}
      class="hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer select-none"
      tabindex={1}
    >
      <td class="px-2 py-1">📄 ..</td>
      <td class="px-2 py-1"></td>
      <td class="px-2 py-1"></td>
      <td class="px-2 py-1"></td>
    </tr>
  )
}
