import captchaService from "@/api/services/captchaService";
import type { AccountLoginReq } from "#/backend";
import { Icon } from "@/components/icon";
import { GLOBAL_CONFIG } from "@/global-config";
import { useSignIn } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/ui/form";
import { Input } from "@/ui/input";
import { cn } from "@/utils";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { LoginStateEnum, useLoginStateContext } from "./providers/login-provider";

const LOGIN_CONFIG_KEY = "login-config";
type LoginFormValues = Required<Pick<AccountLoginReq, "username" | "password">> & { captcha: string };

export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<"form">) {
	const { t } = useTranslation();
	const [loading, setLoading] = useState(false);
	const [remember, setRemember] = useState(true);
	const navigatge = useNavigate();

	const { loginState, setLoginState } = useLoginStateContext();
	const signIn = useSignIn();

	const [captchaEnabled, setCaptchaEnabled] = useState(false);
	const [captchaImg, setCaptchaImg] = useState<string>("");
	const [captchaUUID, setCaptchaUUID] = useState<string>("");
	const [captchaExpired, setCaptchaExpired] = useState(false);
	const captchaTimer = useRef<number | null>(null);

	const form = useForm<LoginFormValues>({
		defaultValues: {
			username: "admin",
			password: "admin123",
			captcha: "",
		},
	});

	if (loginState !== LoginStateEnum.LOGIN) return null;

	const resetCaptchaTimer = () => {
		if (captchaTimer.current) {
			window.clearTimeout(captchaTimer.current);
			captchaTimer.current = null;
		}
	};

	const refreshCaptcha = async () => {
		try {
			const res = await captchaService.getImageCaptcha();
			setCaptchaEnabled(res.isEnabled);
			setCaptchaImg(res.img || "");
			setCaptchaUUID(res.uuid || "");
			setCaptchaExpired(false);
			form.setValue("captcha", "");

			resetCaptchaTimer();
			if (res.isEnabled && res.expireTime) {
				const remaining = res.expireTime - Date.now();
				if (remaining <= 0) {
					setCaptchaExpired(true);
				} else {
					captchaTimer.current = window.setTimeout(() => setCaptchaExpired(true), remaining);
				}
			}
		} catch (err) {
			setCaptchaEnabled(false);
			setCaptchaImg("");
			setCaptchaUUID("");
			setCaptchaExpired(false);
		}
	};

	useEffect(() => {
		try {
			const raw = window.localStorage.getItem(LOGIN_CONFIG_KEY);
			if (raw) {
				const saved = JSON.parse(raw);
				const rememberMe = Boolean(saved?.rememberMe);
				setRemember(rememberMe);
				form.setValue("username", rememberMe ? saved?.username || "admin" : "admin");
				form.setValue("password", rememberMe ? saved?.password || "admin123" : "admin123");
			}
		} catch {}
		refreshCaptcha();

		return () => resetCaptchaTimer();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleFinish = async (values: LoginFormValues) => {
		setLoading(true);
		try {
			if (captchaEnabled && captchaExpired) {
				toast.error("验证码已过期，请点击刷新", { position: "top-center" });
				return;
			}

			await signIn({
				username: values.username,
				password: values.password,
				captcha: captchaEnabled ? values.captcha : undefined,
				uuid: captchaEnabled ? captchaUUID : undefined,
			});

			try {
				window.localStorage.setItem(
					LOGIN_CONFIG_KEY,
					JSON.stringify({
						rememberMe: remember,
						username: remember ? values.username : "",
						password: remember ? values.password : "",
					}),
				);
			} catch {}

			navigatge(GLOBAL_CONFIG.defaultRoute, { replace: true });
			toast.success(t("sys.login.loginSuccessTitle"), {
				closeButton: true,
			});
		} catch (err) {
			await refreshCaptcha();
			form.setValue("captcha", "");
			throw err;
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
									<Input type="password" placeholder="admin123" {...field} suppressHydrationWarning />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					{captchaEnabled && (
						<FormField
							control={form.control}
							name="captcha"
							rules={{ required: "请输入验证码" }}
							render={({ field }) => (
								<FormItem>
									<FormLabel>验证码</FormLabel>
									<FormControl>
										<div className="flex items-center gap-2">
											<Input placeholder="请输入验证码" maxLength={4} {...field} />
											<div className="relative cursor-pointer select-none" onClick={refreshCaptcha} role="button" tabIndex={0}>
												<img src={captchaImg} alt="captcha" className="h-10 w-28 rounded border border-border object-contain bg-white" />
												{captchaExpired && (
													<div className="absolute inset-0 flex items-center justify-center rounded bg-black/70 text-xs text-white">
														已过期，点击刷新
													</div>
												)}
											</div>
										</div>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
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
					<div className="grid gap-4 sm:grid-cols-2">
						<Button variant="outline" className="w-full" onClick={() => setLoginState(LoginStateEnum.MOBILE)}>
							<Icon icon="uil:mobile-android" size={20} />
							{t("sys.login.mobileSignInFormTitle")}
						</Button>
						<Button variant="outline" className="w-full" onClick={() => setLoginState(LoginStateEnum.QR_CODE)}>
							<Icon icon="uil:qrcode-scan" size={20} />
							{t("sys.login.qrSignInFormTitle")}
						</Button>
					</div>

					{/* 其他登录方式 */}
					<div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
						<span className="relative z-10 bg-background px-2 text-muted-foreground">{t("sys.login.otherSignIn")}</span>
					</div>
					<div className="flex cursor-pointer justify-around text-2xl">
						<Button variant="ghost" size="icon">
							<Icon icon="mdi:github" size={24} />
						</Button>
						<Button variant="ghost" size="icon">
							<Icon icon="mdi:wechat" size={24} />
						</Button>
						<Button variant="ghost" size="icon">
							<Icon icon="ant-design:google-circle-filled" size={24} />
						</Button>
					</div>

					{/* 注册 */}
					<div className="text-center text-sm">
						{t("sys.login.noAccount")}
						<Button variant="link" className="px-1" onClick={() => setLoginState(LoginStateEnum.REGISTER)}>
							{t("sys.login.signUpFormTitle")}
						</Button>
					</div>
				</form>
			</Form>
		</div>
	);
}

export default LoginForm;
