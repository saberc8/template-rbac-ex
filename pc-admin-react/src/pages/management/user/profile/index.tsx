import { Col, Row } from "antd";
import BasicInfoCard from "./basic-info-card";
import SecuritySettingsCard from "./security-settings-card";

export default function UserProfilePage() {
	return (
		<div className="p-4">
			<Row gutter={[16, 16]} align="stretch" wrap>
				<Col xs={24} sm={24} md={10} lg={10} xl={7} xxl={7}>
					<BasicInfoCard />
				</Col>
				<Col xs={24} sm={24} md={14} lg={14} xl={17} xxl={17}>
					<SecuritySettingsCard />
				</Col>
			</Row>
		</div>
	);
}
