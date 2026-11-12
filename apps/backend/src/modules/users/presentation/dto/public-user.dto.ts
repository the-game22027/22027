/** What any player may see of another (API.md §5 `PublicUser`), shared by every module's responses. */
export class PublicUserDto {
  id!: string;
  displayName!: string;
  username!: string | null;
  avatarUrl!: string | null;
}
