/** @module config/transitionWords */

/**
 * Returns a list of transition words consisting of single words
 *
 * @type {string[]} The list of single transition words.
 */
export const singleWords = [ "اگر", "اما", "باری", "پس", "تا", "چون", "  چه", "خواه", " را", "زیرا", "که", "لیکن",
	"نه", "نیز", "و", "ولی", "هم", " یا" ];

export const multipleWords = [ "ازآنکه", "ازآنجا که", "از این رو", "از این گذشته", "از بس", "از بس که", "از بهر آ‌نکه", "اکنون که",
	"اگرچه", "اگر چنانچه", "اگرچنانکه", "الا اینکه", "آنجا که", "آنگاه که", "با این حال", "بااینکه", "بالعکس", "با وجود این",
	"با وجود اینکه", "بس که", "بلکه", "بنابراین", "به جز", "به شرط آ‌نکه", "به طوری که", "به هر حال", "بی آنکه", "تااینکه",
	"تا آنکه", "تا جایی که", "چنانچه", "چنانکه", "چندان که", "چون که", "در حالیکه", "در صورتی که", "در نتیجه", "زیرا که",
	"سپس", "علیرغم اینکه", "مگر این که", "وانگهی", "وقتی که", "وگرنه", "ولو", "هر چند", "هر گاه که", "هر وقت که",
	"همان طور که", "همان که", "همچنین", "همین که" ];

export const allWords = singleWords.concat( multipleWords );

export default allWords;
