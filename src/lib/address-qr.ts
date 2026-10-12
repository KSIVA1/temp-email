import qrcode from 'qrcode-generator';

// The service generates ASCII email addresses. Encode the address itself,
// never the private mailbox identifier or an inbox-access URL.
export function createAddressQr(address: string): string {
  if (address.length > 254 || address.split('@')[0].length > 64
    || !/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(address)) {
    throw new Error('A receiving email address is required');
  }
  const code = qrcode(0, 'M');
  code.addData(address, 'Byte');
  code.make();
  // Four modules of white quiet zone, with fixed black-on-white contrast.
  return code.createSvgTag({ cellSize:4, margin:16, scalable:true })
    .replace('<svg ', '<svg shape-rendering="crispEdges" ');
}
