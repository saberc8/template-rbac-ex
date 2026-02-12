import { cn } from "@/utils";
import { NavLink } from "react-router";
import { useSiteLogo } from "@/store/siteConfigStore";
import { resolveAssetUrl } from "@/utils/asset-url";
import { Icon } from "../icon";

interface Props {
	size?: number | string;
	className?: string;
}

function Logo({ size = 50, className }: Props) {
	const siteLogo = useSiteLogo();
	const src = siteLogo ? resolveAssetUrl(siteLogo) : "";

	return (
		<NavLink to="/" className={cn(className)}>
			{src ? (
				<img src={src} alt="logo" style={{ width: size, height: size }} className="inline-block object-contain" />
			) : (
				<Icon icon="local:ic-logo-badge" size={size} color="var(--colors-palette-primary-default)" />
			)}
		</NavLink>
	);
}

export default Logo;
