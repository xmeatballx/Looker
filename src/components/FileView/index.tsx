import {
  Header,
  HeaderGroup,
  Row,
  SortingState,
  createSolidTable,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
} from "@tanstack/solid-table";
import {
  For,
  createSignal,
  onMount,
  createEffect,
  onCleanup
} from "solid-js";
import { twMerge } from 'tailwind-merge';
import { register, unregister } from "@tauri-apps/api/globalShortcut";
import {
  DragDropProvider,
  DragDropSensors,
  DragOverlay,
  Draggable,
  Droppable,
  closestCenter,
} from "@thisbeyond/solid-dnd";
import { invoke } from '@tauri-apps/api';
import { columns } from "./createFileViewTable";
import { DraggableRow } from "./DragDropRow";
import { DroppableRow } from "./DroppableRow";
import { DirEntity } from "../../types";
import { } from "solid-js";
import { listen } from '@tauri-apps/api/event'
import { ask, message } from "@tauri-apps/api/dialog";

interface Props {
  files: any,
  path: string,
  isSearch: boolean,
  onChangeDir: (dir: DirEntity) => Promise<void>,
  onSearch: (query: string) => Promise<void>,
  onCreateFile: (name: string) => Promise<void>,
  onCreateFolder: (name: string) => Promise<void>,
  onDelete: (path: string, isDir: boolean) => Promise<void>
}

export function FileView(props: Props) {
  const [selectedItems, setSelectedItems] = createSignal([] as DirEntity[]);
  const [sorting, setSorting] = createSignal<SortingState>([]);
  const [searchVisible, setSearchVisible] = createSignal(false);
  const [nameInputVisible, setNameInputVisible] = createSignal(false);
  const [activeItem, setActiveItem] = createSignal(null);
  const [source, setSource] = createSignal(null);
  const [dest, setDest] = createSignal(null);
  const [createMode, setCreateMode] = createSignal(null);
  let searchBar: HTMLInputElement;
  let nameFormInput: HTMLFormElement;
  const table = createSolidTable({
    get data() {
      return props.files
    },
    state: {
      get sorting() {
        return sorting();
      }
    },
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  function isSelected(row: any) {
    return selectedItems()?.filter((item: any) => item.path == row.path).length > 0;
  }

  const onDragStart = ({ draggable }: any) => setActiveItem(props.files.filter((file: any) => draggable.id == file.path)[0]);

  function onDragEnd({ draggable, droppable }: { draggable: Draggable, droppable: Droppable }) {
    if (droppable && draggable && droppable.id != draggable.id) {
      const source = props.files.filter((f: DirEntity) => f.path == draggable.id)[0];
      let dest = props.files.filter((f: DirEntity) => f.path == droppable.id)[0];
      if (!dest) {
        dest = { name: ".." } as DirEntity;
      }
      setSource(source);
      setDest(dest);
    }
  }

  function moveFileUp(source: DirEntity) {
    console.log(source);
    let pathArray = source.path.split("/");
    pathArray.splice(pathArray.length - 2, 2);
    const path = pathArray.join("/") + "/";
    invoke(
      "move_file",
      {
        source: source.path,
        dest: path + "/" + source.name
      }
    ).then(() => {
      props.onChangeDir({
        name: "..",
        path: "",
        file_type: "symbol"
      } as DirEntity)
    });
  }

  function moveFileDown(source: DirEntity, dest: DirEntity) {
    let pathArray = source.path.split("/");
    pathArray.splice(pathArray.length - 1, 1);
    invoke(
      "move_file",
      {
        source: source.path,
        dest: dest.path + "/" + source.name
      }
    ).then(() => {
      props.onChangeDir(dest);
    });
  }

  function handleNameFormSubmit(e: SubmitEvent) {
    e.preventDefault()
    const data = new FormData(e.target as HTMLFormElement);
    if (createMode() == "file") {
      props.onCreateFile((data.get("name") as string))
    } else {
      props.onCreateFolder((data.get("name")) as string)
    }
    setNameInputVisible(false)
  }

  createEffect(() => {
    if (dest()?.name == ".." && source()) {
      moveFileUp(source());
    } else if (dest()?.file_type != "file" && source()) {
      moveFileDown(source(), dest());
    }
  });

  let unlisten: any;
  onMount(() => {
    async function init() {
      await unregister('CommandOrControl+/');
      await register('CommandOrControl+/', () => {
        setSearchVisible(!searchVisible())
        searchBar?.focus()
      })
      await unregister('CommandOrControl+n');
      await register('CommandOrControl+n', () => {
        setNameInputVisible(true)
        nameFormInput?.focus()
      })
      unlisten = await listen('menu', (event) => {
        console.log(event)
        switch (event.payload) {
          default:
            console.log("event not implemented")
            break;

          case "create_file":
            setNameInputVisible(true);
            nameFormInput?.focus();
            setCreateMode("file");
            break;

          case "create_folder":
            setNameInputVisible(true);
            nameFormInput?.focus()
            setCreateMode("folder");
            break;

          case "delete":
            const triggerDelete = async () => {
              if (selectedItems().length > 0) {
              const item = selectedItems()[0];
              const confirmation = await ask(`Are you sure you want to delete ${item.name}?`)
              if (confirmation) props.onDelete(item.path, item.file_type == "directory");
              console.log(confirmation);
              } else {
                await message("No file selected");
              }
            }
            triggerDelete();
            break;
        }
      })
    }
    init();
  });
  onCleanup(() => unlisten());
  return (
    <table class="w-full table-fixed whitespace-nowrap">
      <thead>
        <For each={table.getHeaderGroups()}>
          {(headerGroup: HeaderGroup<DirEntity>) => (
            <tr>
              <For each={headerGroup.headers}>
                {(header: Header<DirEntity, any>) => (
                  <th
                    onClick={header.column.getToggleSortingHandler()}
                    class={twMerge("text-left border dark:border-slate-500 p-2 cursor-pointer", (header.column.id == "name" ? "w-1/2" : "w-1/6"))}
                    tabindex={1}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                  </th>
                )}
              </For>
            </tr>
          )}
        </For>
      </thead>
      {searchVisible() && (
        <thead>
          <tr>
            <th>
              <input
                class="w-[200%] dark:bg-slate-700 p-1 font-normal"
                placeholder="search"
                onInput={(e) => {
                  const query = e.target.value;
                  if (query == "") {
                    setSearchVisible(false)
                  }
                  props.onSearch(e.target.value)
                }}
                ref={searchBar}
                tabindex={1}
              />
            </th>
          </tr>
        </thead>)}
      {nameInputVisible() && (
        <thead>
          <tr>
            <th>
              <form onSubmit={handleNameFormSubmit}>
                <input
                  name="name"
                  class="w-[200%] dark:bg-slate-700 p-1 font-normal"
                  placeholder={`name your file ${createMode()}`}
                  ref={searchBar}
                  ref={nameFormInput}
                  tabindex={1}
                />
              </form>
            </th>
          </tr>
        </thead>)}
      <tbody class="column">
        <DragDropProvider
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          collisionDetector={closestCenter}
        >
          <DragDropSensors />
          <DroppableRow onChangeDir={(dir: DirEntity) => props.onChangeDir(dir)} />
          <For each={table.getRowModel().rows}>
            {(row: Row<DirEntity>) => (
              <DraggableRow
                row={row}
                isSelected={isSelected}
                searchMode={props.isSearch}
                onChangeDir={dir => props.onChangeDir(dir)}
                onSelectItem={(item) => {
                  setSelectedItems([item])
                  console.log(selectedItems())
                }} />
            )}
          </For>
          <DragOverlay>
            <div class="sortable w-full bg-slate-800 text-slate-300 py-1 px-2 cursor-pointer opacity-[35%]">{activeItem() ? activeItem().name : ""}</div>
          </DragOverlay>
        </DragDropProvider >
      </tbody>
      <tfoot>
        <tr class="fixed bottom-0 w-full flex justify-end">
          <td class="p-1 px-2 dark:bg-slate-800 text-right dark:bg-opacity-85 font-bold text-lg">
            {props.path}
          </td>
        </tr>
        <For each={table.getFooterGroups()}>
          {(footerGroup: HeaderGroup<DirEntity>) => (
            <tr>
              <For each={footerGroup.headers}>
                {(header: Header<DirEntity, string>) => (
                  <th class="w-[200px]">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                        header.column.columnDef.footer,
                        header.getContext()
                      )}
                  </th>
                )}
              </For>
            </tr>
          )}
        </For>
      </tfoot>
    </table >
  )
};

