import { ColumnDef, createSolidTable, getCoreRowModel, getSortedRowModel } from "@tanstack/solid-table";
import { DirEntity } from "../../types";
import { DateTime } from "luxon";

export function getSize(bytes: number) {
	if (bytes) {
		const gb = bytes / 1024 / 1024;
		const mb = bytes / 1024;
		if (gb > 1) {
			return gb.toFixed(1) + "GB"
		} else {
			return mb.toFixed(1) + "MB"
		}
	} else {
		return "---"
	}
}

export const columns: ColumnDef<DirEntity>[] =
	[
		{
			accessorKey: "name",
			cell: (info: any) => info.getValue(),
		},
		{
			accessorKey: "file_size",
			cell: (info: any) => getSize(info.getValue())
		},
		{
			accessorKey: "created_at",
			cell: (info: any) => info.getValue() ? DateTime.fromISO(info.getValue()).toLocaleString(DateTime.DATETIME_SHORT) : ""
		},
		{
			accessorKey: "edited_at",
			cell: (info: any) => info.getValue() ? DateTime.fromISO(info.getValue()).toLocaleString(DateTime.DATETIME_SHORT) : ""
		},

	];

export function createFileViewTable(files: DirEntity[], sorting: { getter: any, setter: any }) {
	return {
		get data() {
			return files
		},
		state: {
			get sorting() {
				return sorting.getter();
			}
		},
		columns,
		onSortingChange: sorting.setter,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel()
	};
}
