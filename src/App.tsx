import { createSignal, onMount, createResource } from "solid-js";
import { homeDir } from "@tauri-apps/api/path";
import { invoke } from '@tauri-apps/api';
import "./App.css";
import { FileView } from "./components/FileView";
import { Command, open } from '@tauri-apps/api/shell'
import { DirEntity } from "./types";
import { Show } from "solid-js";

function App() {
  const [path, { mutate: mutatePath }] = createResource<string>(async () => { return await homeDir() });
  const [files, { mutate: mutateFiles, refetch }] = createResource<DirEntity[]>(path, getFiles);

  const [isSearch, setIsSearch] = createSignal(false);

  async function getFiles(path: string) {
    try {
      console.log("PATH: ", path)
      const { directories, files }: { directories: string[], files: string[] } = await invoke('get_files', { path: path });
      return [
        ...directories, ...files
      ]
    } catch (err) {
      console.error(err);
    }
  }

  async function changePath(file: any) {
    try {
      console.log("FILE: ", file);
      if (file.file_type != "file") {
        if (file.name == "..") {
          let pathArray = path().split("/");
          pathArray.splice(pathArray.length - 1, 1);
          const newPath = pathArray.join("/");
          mutatePath(newPath)
        } else {
          mutatePath(file.path);
        }
      } else {
        const splitName = file.name.split(".");
        const ext = splitName[splitName.length - 1];
        if (["ts", "tsx", "rs", "nix", "txt", "md"].includes(ext)) {
          await invoke('open_terminal', { path: file.path })
        } else if (ext == "svg") {
          await new Command('open_inkscape', file.path).spawn()
        } else {
          open(file.path).then((data) => console.log(data)).catch(async (err) => {
            console.log(err);
            await invoke('open_terminal', { path: file.path })
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function search(query: string) {
    try {
      if (query != "") {
        setIsSearch(true);
        const { directories, files } = await invoke('search_dir', { path: path(), query });
        mutateFiles([...directories, ...files]);
      } else {
        setIsSearch(false);
        refetch()
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function createFile(name: string): Promise<void> {
    try {
     await invoke("create_file", { name: name, path: path() }) 
     refetch();
    } catch(err) {
      console.error(err);
    }
  }

  async function createFolder(name: string): Promise<void> {
    try {
     await invoke("create_folder", { name: name, path: path() }) 
     refetch();
    } catch(err) {
      console.error(err);
    }
  }

  async function deleteEntity(path: string, isDir: boolean) {
    try {
      await invoke("delete_entity", { path, isDir: isDir });
      refetch();
    } catch(err) {
      console.error(err);
    }
  }

  onMount(() => {
    const init = async () => {
      const home = await homeDir();
      mutatePath(home);
    }
    init();
  })

  return (
    <div class="dark:bg-slate-900 dark:text-slate-300 w-screen min-h-[100vh]">
      <Show when={files()}>
        <FileView
          files={files()}
          path={path()}
          isSearch={isSearch()}
          onChangeDir={(dir: DirEntity) => changePath(dir)}
          onSearch={(query: string) => search(query)}
          onCreateFile={(name: string) => createFile(name)}
          onCreateFolder={(name: string) => createFolder(name)}
          onDelete={(path: string, isDir: boolean) => deleteEntity(path, isDir)}
        />
      </Show>
    </div>
  );
}

export default App;
