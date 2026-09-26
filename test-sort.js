const keys = ['c4', 'c2', 'c1', 'c5', 'c3'];
const badSort = [...keys].sort(([keyA], [keyB]) => (parseInt(keyA.replace(/\D/g, '')) || 0) - (parseInt(keyB.replace(/\D/g, '')) || 0));
const goodSort = [...keys].sort((keyA, keyB) => (parseInt(keyA.replace(/\D/g, '')) || 0) - (parseInt(keyB.replace(/\D/g, '')) || 0));
console.log('Bad:', badSort);
console.log('Good:', goodSort);
