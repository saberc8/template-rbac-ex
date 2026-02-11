import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";
import { cn } from "@/utils";

type ColumnFixedSide = "left" | "right";

type PaginationProps = {
	page: number;
	pageSize: number;
	total: number;
	onChange: (page: number, pageSize: number) => void;
	pageSizeOptions?: number[];
};

type SelectionProps<T> = {
	selectedRowIds: Array<string | number>;
	onSelectedRowIdsChange: (ids: Array<string | number>) => void;
	isRowSelectable?: (row: T) => boolean;
};

function DataTablePagination({
	page,
	pageSize,
	total,
	onChange,
	pageSizeOptions = [10, 20, 30, 50, 100],
}: PaginationProps) {
	const safePageSize = Math.max(1, Number(pageSize) || 10);
	const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / safePageSize));
	const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);

	return (
		<div className="flex flex-wrap items-center justify-between gap-2">
			<div className="text-sm text-muted-foreground">
				共 {Number(total) || 0} 条 · 第 {safePage}/{totalPages} 页
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<div className="flex items-center gap-2">
					<span className="text-sm text-muted-foreground">每页</span>
					<Select
						value={String(safePageSize)}
						onValueChange={(v) => {
							const nextSize = Number(v) || safePageSize;
							onChange(1, nextSize);
						}}
					>
						<SelectTrigger className="w-[92px]" size="sm">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{pageSizeOptions.map((opt) => (
								<SelectItem key={opt} value={String(opt)}>
									{opt}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<Button
					variant="secondary"
					size="sm"
					disabled={safePage <= 1}
					onClick={() => onChange(safePage - 1, safePageSize)}
				>
					<ChevronLeftIcon className="size-4" />
					上一页
				</Button>
				<Button
					variant="secondary"
					size="sm"
					disabled={safePage >= totalPages}
					onClick={() => onChange(safePage + 1, safePageSize)}
				>
					下一页
					<ChevronRightIcon className="size-4" />
				</Button>
			</div>
		</div>
	);
}

export default function DataTable<TData extends object>({
	title,
	actions,
	search,
	columns,
	data,
	loading,
	empty,
	getRowId,
	onRowClick,
	onRowDoubleClick,
	rowClassName,
	selection,
	pagination,
}: {
	title?: ReactNode;
	actions?: ReactNode;
	search?: ReactNode;
	columns: Array<ColumnDef<TData, any>>;
	data: TData[];
	loading?: boolean;
	empty?: ReactNode;
	getRowId?: (row: TData, index: number) => string;
	onRowClick?: (row: TData) => void;
	onRowDoubleClick?: (row: TData) => void;
	rowClassName?: (row: TData) => string;
	selection?: SelectionProps<TData>;
	pagination?: PaginationProps;
}) {
	const emptyNode = empty ?? <div className="text-sm text-muted-foreground">暂无数据</div>;

	const inferFixedSide = (colDef: ColumnDef<TData, any>): ColumnFixedSide | undefined => {
		const meta = colDef.meta as any;
		const declared = meta?.fixed as ColumnFixedSide | undefined;
		if (declared === "left" || declared === "right") return declared;

		if (typeof colDef.header === "string" && colDef.header === "操作") return "right";
		return undefined;
	};

	const selectionColumn = useMemo(() => {
		if (!selection) return null;

		const selectedSet = new Set(selection.selectedRowIds.map((x) => String(x)));
		const selectable = (row: TData) => selection.isRowSelectable?.(row) ?? true;

		return {
			id: "__select__",
			header: () => {
				const selectableRows = (data || []).filter(selectable);
				const allSelected =
					selectableRows.length > 0 && selectableRows.every((r, i) => selectedSet.has(String(getRowId?.(r, i) ?? i)));
				const someSelected =
					selectableRows.some((r, i) => selectedSet.has(String(getRowId?.(r, i) ?? i))) && !allSelected;

				return (
					<Checkbox
						checked={allSelected ? true : someSelected ? "indeterminate" : false}
						onCheckedChange={(checked) => {
							if (!checked) {
								const next = new Set(selectedSet);
								for (const [idx, r] of (data || []).entries()) {
									next.delete(String(getRowId?.(r, idx) ?? idx));
								}
								selection.onSelectedRowIdsChange(Array.from(next));
								return;
							}
							const next = new Set(selectedSet);
							for (const [idx, r] of (data || []).entries()) {
								if (!selectable(r)) continue;
								next.add(String(getRowId?.(r, idx) ?? idx));
							}
							selection.onSelectedRowIdsChange(Array.from(next));
						}}
						aria-label="Select all"
					/>
				);
			},
			cell: ({ row }: any) => {
				const rowId = String(row.id);
				const original = row.original as TData;
				const disabled = !selectable(original);
				return (
					<Checkbox
						checked={selectedSet.has(rowId)}
						disabled={disabled}
						onCheckedChange={(checked) => {
							const next = new Set(selectedSet);
							if (!checked) next.delete(rowId);
							else next.add(rowId);
							selection.onSelectedRowIdsChange(Array.from(next));
						}}
						aria-label="Select row"
					/>
				);
			},
			meta: { align: "center" as const },
			size: 44,
		} satisfies ColumnDef<TData, any>;
	}, [data, getRowId, selection]);

	const effectiveColumns = useMemo(() => {
		return selectionColumn ? [selectionColumn, ...columns] : columns;
	}, [columns, selectionColumn]);

	const table = useReactTable({
		data: data || [],
		columns: effectiveColumns,
		getCoreRowModel: getCoreRowModel(),
		getRowId: getRowId as any,
	});

	const leafColumns = table.getVisibleLeafColumns();
	const leftOffsets = new Map<string, number>();
	const rightOffsets = new Map<string, number>();

	let accLeft = 0;
	for (const col of leafColumns) {
		const fixed = inferFixedSide(col.columnDef as any);
		if (fixed !== "left") continue;
		leftOffsets.set(col.id, accLeft);
		accLeft += col.getSize();
	}

	let accRight = 0;
	for (let i = leafColumns.length - 1; i >= 0; i -= 1) {
		const col = leafColumns[i];
		const fixed = inferFixedSide(col.columnDef as any);
		if (fixed !== "right") continue;
		rightOffsets.set(col.id, accRight);
		accRight += col.getSize();
	}

	return (
		<div className="flex flex-col gap-3 min-w-0">
			{title || actions ? (
				<div className="flex flex-wrap items-center justify-between gap-2">
					{title ? <div className="text-base font-medium">{title}</div> : <div />}
					{actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
				</div>
			) : null}

			{search ? <div className="flex flex-wrap items-center gap-2">{search}</div> : null}

			<div className="rounded-md border min-w-0">
				<Table className="w-max min-w-full">
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => {
									const meta = header.column.columnDef.meta as any;
									const fixed = inferFixedSide(header.column.columnDef as any);
									const stickyOffset =
										fixed === "left"
											? leftOffsets.get(header.column.id)
											: fixed === "right"
												? rightOffsets.get(header.column.id)
												: undefined;
									return (
										<TableHead
											key={header.id}
											className={cn(
												meta?.align === "center" && "text-center",
												meta?.align === "right" && "text-right",
												fixed && "sticky bg-background",
												fixed === "left" && "z-30 border-r",
												fixed === "right" && "z-30 border-l",
												meta?.className,
											)}
											style={{
												width: header.getSize() ? `${header.getSize()}px` : undefined,
												left: fixed === "left" && stickyOffset !== undefined ? `${stickyOffset}px` : undefined,
												right: fixed === "right" && stickyOffset !== undefined ? `${stickyOffset}px` : undefined,
											}}
										>
											{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
										</TableHead>
									);
								})}
							</TableRow>
						))}
					</TableHeader>

					<TableBody>
						{loading ? (
							<TableRow>
								<TableCell colSpan={effectiveColumns.length} className="py-10">
									<div className="text-sm text-muted-foreground">Loading...</div>
								</TableCell>
							</TableRow>
						) : table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									className={cn(
										"group",
										onRowClick || onRowDoubleClick ? "cursor-pointer" : "",
										rowClassName ? rowClassName(row.original as TData) : "",
									)}
									onClick={() => onRowClick?.(row.original as TData)}
									onDoubleClick={() => onRowDoubleClick?.(row.original as TData)}
								>
									{row.getVisibleCells().map((cell) => {
										const meta = cell.column.columnDef.meta as any;
										const fixed = inferFixedSide(cell.column.columnDef as any);
										const stickyOffset =
											fixed === "left"
												? leftOffsets.get(cell.column.id)
												: fixed === "right"
													? rightOffsets.get(cell.column.id)
													: undefined;
										return (
											<TableCell
												key={cell.id}
												className={cn(
													meta?.align === "center" && "text-center",
													meta?.align === "right" && "text-right",
													fixed && "sticky bg-background group-hover:bg-muted",
													fixed === "left" && "z-20 border-r",
													fixed === "right" && "z-20 border-l",
													meta?.className,
												)}
												style={{
													width: cell.column.getSize() ? `${cell.column.getSize()}px` : undefined,
													left: fixed === "left" && stickyOffset !== undefined ? `${stickyOffset}px` : undefined,
													right: fixed === "right" && stickyOffset !== undefined ? `${stickyOffset}px` : undefined,
												}}
											>
												{flexRender(cell.column.columnDef.cell, cell.getContext())}
											</TableCell>
										);
									})}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell colSpan={effectiveColumns.length} className="py-10">
									{emptyNode}
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{pagination ? (
				<DataTablePagination
					page={pagination.page}
					pageSize={pagination.pageSize}
					total={pagination.total}
					onChange={pagination.onChange}
					pageSizeOptions={pagination.pageSizeOptions}
				/>
			) : null}
		</div>
	);
}
