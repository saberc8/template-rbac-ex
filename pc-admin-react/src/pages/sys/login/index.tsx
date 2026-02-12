import PlaceholderImg from "@/assets/images/background/placeholder.svg";
import LocalePicker from "@/components/locale-picker";
import Logo from "@/components/logo";
import { GLOBAL_CONFIG } from "@/global-config";
import SettingButton from "@/layouts/components/setting-button";
import { useSiteBeian, useSiteCopyright, useSiteTitle } from "@/store/siteConfigStore";
import { useUserToken } from "@/store/userStore";
import { Navigate } from "react-router";
import LoginForm from "./login-form";
import { LoginProvider } from "./providers/login-provider";
import RegisterForm from "./register-form";
import ResetForm from "./reset-form";

function LoginPage() {
	const token = useUserToken();
	const siteTitle = useSiteTitle();
	const siteCopyright = useSiteCopyright();
	const siteBeian = useSiteBeian();

	if (token.accessToken) {
		return <Navigate to={GLOBAL_CONFIG.defaultRoute} replace />;
	}

	return (
		<div className="relative grid min-h-svh lg:grid-cols-2 bg-background">
			<div className="flex flex-col gap-4 p-6 md:p-10">
				<div className="flex justify-center gap-2 md:justify-start">
					<div className="flex items-center gap-2 font-medium cursor-pointer">
						<Logo size={28} />
						<span>{siteTitle}</span>
					</div>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-xs">
						<LoginProvider>
							<LoginForm />
							<RegisterForm />
							<ResetForm />
						</LoginProvider>
						<div className="mt-6 space-y-1 text-center text-xs text-muted-foreground">
							{siteCopyright ? <div>{siteCopyright}</div> : null}
							{siteBeian ? <div>{siteBeian}</div> : null}
						</div>
					</div>
				</div>
			</div>

			<div className="relative hidden bg-background-paper lg:block">
				<img src={PlaceholderImg} alt="placeholder img" className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.5] dark:grayscale" />
			</div>

			<div className="absolute right-2 top-0 flex flex-row">
				<LocalePicker />
				<SettingButton />
			</div>
		</div>
	);
}
export default LoginPage;
