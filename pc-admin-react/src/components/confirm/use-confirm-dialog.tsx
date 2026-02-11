import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/ui/alert-dialog";

type ConfirmOptions = {
	title: ReactNode;
	description?: ReactNode;
	confirmText?: string;
	cancelText?: string;
	destructive?: boolean;
};

type ConfirmState = {
	open: boolean;
	title: ReactNode;
	description?: ReactNode;
	confirmText: string;
	cancelText: string;
	destructive: boolean;
};

export function useConfirmDialog() {
	const resolverRef = useRef<((v: boolean) => void) | null>(null);

	const [state, setState] = useState<ConfirmState>({
		open: false,
		title: "",
		description: undefined,
		confirmText: "确认",
		cancelText: "取消",
		destructive: false,
	});

	const close = useCallback((result: boolean) => {
		setState((p) => ({ ...p, open: false }));
		resolverRef.current?.(result);
		resolverRef.current = null;
	}, []);

	const confirm = useCallback((options: ConfirmOptions) => {
		const next: ConfirmState = {
			open: true,
			title: options.title,
			description: options.description,
			confirmText: options.confirmText || "确认",
			cancelText: options.cancelText || "取消",
			destructive: Boolean(options.destructive),
		};

		setState(next);
		return new Promise<boolean>((resolve) => {
			resolverRef.current = resolve;
		});
	}, []);

	const ConfirmDialog = useMemo(() => {
		return (
			<AlertDialog
				open={state.open}
				onOpenChange={(open) => {
					if (!open) close(false);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{state.title}</AlertDialogTitle>
						{state.description ? <AlertDialogDescription>{state.description}</AlertDialogDescription> : null}
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => close(false)}>{state.cancelText}</AlertDialogCancel>
						<AlertDialogAction variant={state.destructive ? "destructive" : "default"} onClick={() => close(true)}>
							{state.confirmText}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		);
	}, [close, state.cancelText, state.confirmText, state.description, state.destructive, state.open, state.title]);

	return { confirm, ConfirmDialog } as const;
}
