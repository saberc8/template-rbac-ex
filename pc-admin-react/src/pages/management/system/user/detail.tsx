import { systemUserService } from "@/api/services/systemUserService";
import { useParams } from "@/routes/hooks";
import { Card, CardContent } from "@/ui/card";
import { useQuery } from "@tanstack/react-query";

export default function UserDetail() {
	const { id } = useParams();
	const { data, isFetching } = useQuery({
		queryKey: ["systemUser.get", id],
		queryFn: () => systemUserService.get(String(id)),
		enabled: Boolean(id),
	});
	return (
		<Card>
			<CardContent>
				<p>{isFetching ? "Loading..." : `This is the detail page of ${data?.username || "-"}`}</p>
			</CardContent>
		</Card>
	);
}
