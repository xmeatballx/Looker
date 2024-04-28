import { Cell, flexRender } from "@tanstack/solid-table";
import { DirEntity } from "../../types";
import { twMerge } from "tailwind-merge";
import { createDraggable, createDroppable } from "@thisbeyond/solid-dnd";
import { For } from "solid-js";

interface Props {
  row: any,
  searchMode: boolean,
  isSelected: (row: any) => boolean,
  onChangeDir: (dir: DirEntity) => Promise<void>,
  onSelectItem: (item: DirEntity) => void
}

export function DraggableRow(props: Props) {
console.log(props.searchMode)
  const draggable = createDraggable(props.row.original.path);
  const droppable = createDroppable(props.row.original.path);

  function handleKeyDown(e) {
    if (e.keyCode == 13) {
      props.onChangeDir(props.row.original)
    }
  }

  return (
    <tr
      use:draggable
      use:droppable
      onMouseDown={() => props.onSelectItem(props.row.original)}
      onKeyUp={handleKeyDown}
      onDblClick={(e: any) => {
        e.stopPropagation()
        e.preventDefault()
        props.onChangeDir(props.row.original)
      }}
      class={
        twMerge(
          "sortable hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer select-none dark:focus:bg-slate-800",
          droppable.isActiveDroppable && "bg-slate-600"
        )}
      tabindex={1}
    >
      <For each={props.row.getVisibleCells()}>
        {(cell: Cell<DirEntity, any>) => (
          <td class={twMerge("px-2 py-1 whitespace-nowrap text-ellipsis overflow-hidden", (props.isSelected(props.row.original) ? "bg-slate-100 dark:bg-slate-700" : ""))}>
            {(cell.column.id == "name" ? (props.row.original.file_type == "directory" ? "📁 " : "📄 ") : "") +
              (props.searchMode && cell.column.id == "name" ?
              props.row.original.path :
              flexRender(
                cell.column.columnDef.cell,
                cell.getContext()
              ))}
          </td>
        )}
      </For>
    </tr>
  )
}

