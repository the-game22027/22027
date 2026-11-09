export class SessionInfoDto {
  id!: string;
  platform?: string;
  deviceName?: string;
  createdAt!: string;
  lastUsedAt!: string;
  current!: boolean;
}
