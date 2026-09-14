/** Displays the original Quixadá landscape supplied for the photo frame. */
export function QuixadaRegistrationArtwork() {
  return (
    <div aria-hidden="true" className="relative mt-4 h-44 overflow-hidden sm:h-56 lg:h-72">
      <img
        src="/photo-art/quixada-story-original.png"
        alt=""
        className="absolute inset-0 size-full object-cover object-[center_68%]"
      />
      <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-[#fcf6e9] to-transparent sm:h-16" />
    </div>
  );
}
