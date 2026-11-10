// The rules never download artwork. VF renders all pieces in its own SVG vocabulary.
export const imageURL = () => false;
export const image = () => ({width:240,height:200,complete:true,naturalHeight:200});
export const compositeImage = image;
export const getBGImage = () => '';
export const setViewScale = () => {};
export const waitLoaded = async () => {};
export const drawImageAroundPoint = () => '';
