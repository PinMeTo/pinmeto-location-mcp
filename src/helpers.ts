export function formatListResponse(response: any[], areAllPagesFetched: boolean): string {
  if (response.length === 0) {
    return 'The response was empty...';
  }
  let formattedMessage = '-'.repeat(20);
  if (!areAllPagesFetched) {
    formattedMessage =
      'Not All pages were successfully fetched, collected data:\n' + formattedMessage;
  }
  for (const result of response) {
    formattedMessage += '\n' + JSON.stringify(result, null, 2) + '\n' + '-'.repeat(20);
  }
  return formattedMessage;
}
