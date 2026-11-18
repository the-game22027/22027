/// One page of a cursor-paged list (API §1). [nextCursor] is opaque; `null` means the last
/// page. Pass it back unchanged, with the same filters, to get the next page.
class CursorPage<T> {
  const CursorPage({required this.items, required this.nextCursor});

  final List<T> items;
  final String? nextCursor;

  bool get hasMorePages => nextCursor != null;
}
