import { captchaService } from "@/api/services/captchaService";
import { GLOBAL_CONFIG } from "@/global-config";
import { useSignIn } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/ui/form";
import { Input } from "@/ui/input";
import { cn } from "@/utils";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { LoginStateEnum, useLoginStateContext } from "./providers/login-provider";

type LoginFormValues = {
	username: string;
	password: string;
	captcha?: string;
};

export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<"form">) {
	const { t } = useTranslation();
	const [loading, setLoading] = useState(false);
	const [remember, setRemember] = useState(true);
	const navigatge = useNavigate();
	const [captchaEnabled, setCaptchaEnabled] = useState(false);
	const [captchaImg, setCaptchaImg] = useState("");
	const [captchaUuid, setCaptchaUuid] = useState("");

	const { loginState, setLoginState } = useLoginStateContext();
	const signIn = useSignIn();

	const form = useForm<LoginFormValues>({
		defaultValues: {
			username: "admin",
			password: "Abcdefg1",
			captcha: "",
		},
	});

	if (loginState !== LoginStateEnum.LOGIN) return null;

	const loadCaptcha = async () => {
		try {
			const data = await captchaService.getImage();
			setCaptchaEnabled(Boolean(data?.isEnabled));
			setCaptchaImg(data?.img || "");
			setCaptchaUuid(data?.uuid || "");
			form.setValue("captcha", "");
		} catch {
			setCaptchaEnabled(false);
			setCaptchaImg("");
			setCaptchaUuid("");
		}
	};

	useEffect(() => {
		loadCaptcha();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleFinish = async (values: LoginFormValues) => {
		setLoading(true);
		try {
			await signIn({
				username: values.username,
				password: values.password,
				captcha: captchaEnabled ? values.captcha : undefined,
				uuid: captchaEnabled ? captchaUuid : undefined,
			});

			// backend 路由模式依赖“启动时已拿到菜单树”来生成动态路由。
			// 登录成功后强制刷新一次，确保 main.tsx 能在有 token 的情况下预拉取 /menu 并构建路由。
			if (GLOBAL_CONFIG.routerMode === "backend" && typeof window !== "undefined") {
				const base = (GLOBAL_CONFIG.publicPath || "/").replace(/\/$/, "");
				const target = `${base}${GLOBAL_CONFIG.defaultRoute}`;
				window.location.replace(target);
				return;
			}

			navigatge(GLOBAL_CONFIG.defaultRoute, { replace: true });
			toast.success(t("sys.login.loginSuccessTitle"), { closeButton: true });
		} catch {
			if (captchaEnabled) {
				await loadCaptcha();
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className={cn("flex flex-col gap-6", className)}>
			<Form {...form} {...props}>
				<form onSubmit={form.handleSubmit(handleFinish)} className="space-y-4">
					<div className="flex flex-col items-center gap-2 text-center">
						<h1 className="text-2xl font-bold">{t("sys.login.signInFormTitle")}</h1>
						<p className="text-balance text-sm text-muted-foreground">{t("sys.login.signInFormDescription")}</p>
					</div>

					<FormField
						control={form.control}
						name="username"
						rules={{ required: t("sys.login.accountPlaceholder") }}
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("sys.login.userName")}</FormLabel>
								<FormControl>
									<Input placeholder="admin" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="password"
						rules={{ required: t("sys.login.passwordPlaceholder") }}
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("sys.login.password")}</FormLabel>
								<FormControl>
									<Input type="password" placeholder="Abcdefg1" {...field} suppressHydrationWarning />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					{captchaEnabled && (
						<div className="grid gap-2">
							<FormField
								control={form.control}
								name="captcha"
								rules={{ required: t("sys.login.captchaPlaceholder") }}
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("sys.login.captcha")}</FormLabel>
										<div className="flex items-center gap-2">
											<FormControl>
												<Input placeholder={t("sys.login.captchaPlaceholder")} autoComplete="off" {...field} />
											</FormControl>
											<button
												type="button"
												className="h-10 w-[140px] overflow-hidden rounded-md border bg-white"
												onClick={loadCaptcha}
												aria-label={t("sys.login.refreshCaptcha")}
											>
												{captchaImg ? (
													<img src={captchaImg} alt="captcha" className="h-full w-full object-contain" />
												) : (
													<span className="text-xs text-gray-500">{t("sys.login.refreshCaptcha")}</span>
												)}
											</button>
										</div>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					)}

					{/* 记住我/忘记密码 */}
					<div className="flex flex-row justify-between">
						<div className="flex items-center space-x-2">
							<Checkbox
								id="remember"
								checked={remember}
								onCheckedChange={(checked) => setRemember(checked === "indeterminate" ? false : checked)}
							/>
							<label
								htmlFor="remember"
								className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
							>
								{t("sys.login.rememberMe")}
							</label>
						</div>
						<Button variant="link" onClick={() => setLoginState(LoginStateEnum.RESET_PASSWORD)} size="sm">
							{t("sys.login.forgetPassword")}
						</Button>
					</div>

					{/* 登录按钮 */}
					<Button type="submit" className="w-full">
						{loading && <Loader2 className="animate-spin mr-2" />}
						{t("sys.login.loginButton")}
					</Button>

					{/* 手机登录/二维码登录 */}
					<div className="text-center text-sm text-muted-foreground">如需账号请联系管理员开通</div>
				</form>
			</Form>
		</div>
	);
}

export default LoginForm;
