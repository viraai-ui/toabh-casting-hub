import '@testing-library/jest-dom'

if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {}
}
