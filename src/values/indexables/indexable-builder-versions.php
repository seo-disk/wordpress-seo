<?php

namespace Yoast\WP\SEO\Values\Indexables;

/**
 * Class Indexable_Builder_Versions
 */
class Indexable_Builder_Versions {

	const DEFAULT_INDEXABLE_BUILDER_VERSION = 1;

	/**
	 * The list of indexable builder versions defined by Yoast SEO Free.
	 * If the key is not in this list, the indexable type will not be managed.
	 * These numbers should be increased if one of the builders implements a new feature.
	 *
	 * @var array
	 */
	protected $indexable_builder_versions_by_type = [
		'date-archive'      => 2,
		'general'           => 2,
		'home-page'         => 3,
		'post'              => 3,
		'post-type-archive' => 3,
		'term'              => 3,
		'user'              => 3,
		'system-page'       => 2,
	];

	/**
	 * Provides the most recent version number for an Indexable's object type.
	 *
	 * @param string $object_type The Indexable type for which you want to know the most recent version.
	 *
	 * @return int The most recent version number for the type, or 1 if the version doesn't exist.
	 */
	public function get_latest_version_for_type( $object_type ) {
		if ( ! \array_key_exists( $object_type, $this->indexable_builder_versions_by_type ) ) {
			return self::DEFAULT_INDEXABLE_BUILDER_VERSION;
		}

		return $this->indexable_builder_versions_by_type[ $object_type ];
	}
}
